import { ServiceUnavailableException } from '@nestjs/common';
import { TecsafeService } from './tecsafe.service';
import { ConfigService } from '../shared/config/config.service';

describe('TecsafeService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock;
    fetchMock.mockReset();
    process.env.OFCP_GATEWAY_URL = 'https://gateway.test';
    process.env.OFCP_SALESCHANNEL_API_KEY = 'tds_sc_test_key';
    process.env.GUEST_SESSION_TTL_DAYS = '7';
  });

  const tokenResponse = (token: string, expiresIn: number) => ({
    ok: true,
    json: () =>
      Promise.resolve({
        access_token: token,
        token_type: 'Bearer',
        expires_in: expiresIn,
        scope: '',
      }),
  });

  it('exchanges a guest token: no customerPayload, oldToken forwarded', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce(tokenResponse('customer-token', 3600));

    const service = new TecsafeService(new ConfigService());
    const token = await service.exchangeCustomerToken('previous-jwt', null);
    expect(token).toBe('customer-token');

    const [scUrl, scInit] = fetchMock.mock.calls[0] as [
      string,
      { body: string },
    ];
    expect(scUrl).toBe('https://gateway.test/v1/auth/jwt/saleschannel');
    expect(JSON.parse(scInit.body)).toEqual({
      saleschannelApiKey: 'tds_sc_test_key',
    });

    const [custUrl, custInit] = fetchMock.mock.calls[1] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(custUrl).toBe(
      'https://gateway.test/v1/auth/jwt/saleschannel-customer',
    );
    expect(custInit.headers.Authorization).toBe('Bearer sc-token');
    const body = JSON.parse(custInit.body) as {
      customerPayload?: unknown;
      previousSaleschannelCustomerJwt?: string;
      guestSessionTTL?: number;
    };
    expect(body.customerPayload).toBeUndefined();
    expect(body.previousSaleschannelCustomerJwt).toBe('previous-jwt');
    expect(body.guestSessionTTL).toBe(7);
  });

  it('includes customerPayload for logged-in users', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce(tokenResponse('customer-token', 3600));

    const service = new TecsafeService(new ConfigService());
    await service.exchangeCustomerToken(undefined, {
      id: 'user-1',
      email: 'jane@example.com',
    });

    const [, custInit] = fetchMock.mock.calls[1] as [string, { body: string }];
    const body = JSON.parse(custInit.body) as {
      customerPayload?: unknown;
      previousSaleschannelCustomerJwt?: string;
    };
    expect(body.customerPayload).toEqual({
      saleschannelCustomerID: 'user-1',
      saleschannelCustomerEmail: 'jane@example.com',
    });
    expect(body.previousSaleschannelCustomerJwt).toBeUndefined();
  });

  it('caches the saleschannel token across exchanges', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce(tokenResponse('customer-token-1', 3600))
      .mockResolvedValueOnce(tokenResponse('customer-token-2', 3600));

    const service = new TecsafeService(new ConfigService());
    await service.exchangeCustomerToken(undefined, null);
    await service.exchangeCustomerToken(undefined, null);

    // 3 calls total: 1x saleschannel login + 2x customer exchange.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('fails clearly when the API key is missing', async () => {
    delete process.env.OFCP_SALESCHANNEL_API_KEY;
    const service = new TecsafeService(new ConfigService());
    await expect(
      service.exchangeCustomerToken(undefined, null),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails clearly when the gateway rejects the exchange', async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse('sc-token', 900))
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({}),
      });

    const service = new TecsafeService(new ConfigService());
    await expect(
      service.exchangeCustomerToken(undefined, null),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
