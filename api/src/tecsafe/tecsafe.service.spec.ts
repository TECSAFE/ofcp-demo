import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TecsafeService } from './tecsafe.service';
import { ConfigService } from '../shared/config/config.service';

const CLIENT_ASSERTION_TYPE =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

describe('TecsafeService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
    process.env.OFCP_TOKEN_URL = 'https://auth.test/application/o/token/';
    process.env.OFCP_SERVICE_ACCOUNT = 'sc-shop-1-test';
    process.env.OFCP_SERVICE_ACCOUNT_TOKEN = 'app-password';
    process.env.OFCP_SALESCHANNEL_CLIENT_ID = 'sc-client-id';
    process.env.OFCP_CUSTOMER_CLIENT_ID = 'customer-client-id';
    process.env.GUEST_SESSION_TTL_DAYS = '7';
  });

  const tokenResponse = (token: string, expiresIn: number) => ({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: 'ofcp',
      }),
  });

  /** Both token requests are form posts; this decodes one into a plain object. */
  const formOf = (call: unknown[]): Record<string, string> =>
    Object.fromEntries(
      new URLSearchParams((call[1] as { body: string }).body).entries(),
    );

  it('logs in at Authentik with the service account, then derives a guest token with the saleschannel token as client assertion', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce(tokenResponse('customer-token', 300));

    const service = new TecsafeService(new ConfigService());
    const token = await service.exchangeCustomerToken('previous-jwt', null);
    expect(token).toBe('customer-token');

    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(loginUrl).toBe('https://auth.test/application/o/token/');
    expect(loginInit.method).toBe('POST');
    expect(loginInit.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(formOf(fetchMock.mock.calls[0])).toEqual({
      grant_type: 'client_credentials',
      client_id: 'sc-client-id',
      username: 'sc-shop-1-test',
      password: 'app-password',
      scope: 'ofcp',
    });

    const [customerUrl] = fetchMock.mock.calls[1] as [string];
    expect(customerUrl).toBe('https://auth.test/application/o/token/');
    const customerForm = formOf(fetchMock.mock.calls[1]);
    expect(customerForm).toMatchObject({
      grant_type: 'client_credentials',
      client_id: 'customer-client-id',
      client_assertion_type: CLIENT_ASSERTION_TYPE,
      client_assertion: 'sc-token',
      scope: 'ofcp',
    });
    expect(customerForm).not.toHaveProperty('username');
    expect(customerForm).not.toHaveProperty('password');
    expect(JSON.parse(customerForm.ofcp_customer)).toEqual({
      guestSessionTTL: 7,
      previousSaleschannelCustomerJwt: 'previous-jwt',
    });
  });

  it('puts the logged-in shopper into ofcp_customer.customerPayload', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce(tokenResponse('customer-token', 300));

    const service = new TecsafeService(new ConfigService());
    await service.exchangeCustomerToken(undefined, {
      id: 'user-1',
      email: 'jane@example.com',
    });

    expect(JSON.parse(formOf(fetchMock.mock.calls[1]).ofcp_customer)).toEqual({
      guestSessionTTL: 7,
      customerPayload: {
        saleschannelCustomerID: 'user-1',
        saleschannelCustomerEmail: 'jane@example.com',
      },
    });
  });

  it('caches the saleschannel token across exchanges', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce(tokenResponse('customer-token-1', 300))
      .mockResolvedValueOnce(tokenResponse('customer-token-2', 300));

    const service = new TecsafeService(new ConfigService());
    await service.exchangeCustomerToken(undefined, null);
    await service.exchangeCustomerToken(undefined, null);

    // 3 calls total: 1x saleschannel login + 2x customer exchange.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails clearly when a credential is missing', async () => {
    delete process.env.OFCP_SERVICE_ACCOUNT_TOKEN;
    const service = new TecsafeService(new ConfigService());
    await expect(
      service.exchangeCustomerToken(undefined, null),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails clearly when Authentik refuses the login', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve(
          '{"error":"invalid_grant","error_description":"Invalid credentials","request_id":"abc"}',
        ),
    });

    const service = new TecsafeService(new ConfigService());
    await expect(
      service.exchangeCustomerToken(undefined, null),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('answers 400 when Authentik refuses the customer exchange (gateway veto reads as invalid_grant), not 503', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () =>
          Promise.resolve('{"error":"invalid_grant","request_id":"abc"}'),
      });

    const service = new TecsafeService(new ConfigService());
    await expect(
      service.exchangeCustomerToken(undefined, null),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('answers 503 when Authentik is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    const service = new TecsafeService(new ConfigService());
    await expect(
      service.exchangeCustomerToken(undefined, null),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('bounds every token request with a timeout signal', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce(tokenResponse('customer-token', 300));

    const service = new TecsafeService(new ConfigService());
    await service.exchangeCustomerToken(undefined, null);

    for (const call of fetchMock.mock.calls as unknown[][]) {
      expect((call[1] as { signal?: unknown }).signal).toBeInstanceOf(
        AbortSignal,
      );
    }
  });
});
