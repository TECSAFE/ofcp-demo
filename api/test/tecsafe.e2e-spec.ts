import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-app';

describe('tecsafe token (e2e)', () => {
  let app: INestApplication;
  const fetchMock = jest.fn();

  beforeAll(async () => {
    process.env.OFCP_GATEWAY_URL = 'https://gateway.test';
    process.env.OFCP_SALESCHANNEL_API_KEY = 'tds_sc_test_key';
    app = await createTestApp();
    global.fetch = fetchMock;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.endsWith('/saleschannel')
              ? {
                  access_token: 'sc-token',
                  token_type: 'Bearer',
                  expires_in: 900,
                  scope: '',
                }
              : {
                  access_token: 'customer-token',
                  token_type: 'Bearer',
                  expires_in: 3600,
                  scope: '',
                },
          ),
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('mints a guest token for anonymous sessions', async () => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/tecsafe/token')
      .send({ oldToken: 'old-jwt' })
      .expect(200);
    const resBody = res.body as { token: string };
    expect(resBody.token).toBe('customer-token');

    const exchangeCall = fetchMock.mock.calls.find(([url]) =>
      (url as string).endsWith('/saleschannel-customer'),
    ) as [string, { body: string }] | undefined;
    const body = JSON.parse(exchangeCall![1].body) as {
      customerPayload?: unknown;
      previousSaleschannelCustomerJwt?: string;
    };
    expect(body.customerPayload).toBeUndefined();
    expect(body.previousSaleschannelCustomerJwt).toBe('old-jwt');
  });

  it('mints a customer token for logged-in sessions', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ email: 'token@example.com', password: 'secret1' })
      .expect(201);

    await agent
      .post('/tecsafe/token')
      .send({ oldToken: 'guest-jwt' })
      .expect(200);

    const exchangeCall = fetchMock.mock.calls.find(([url]) =>
      (url as string).endsWith('/saleschannel-customer'),
    ) as [string, { body: string }] | undefined;
    const body = JSON.parse(exchangeCall![1].body) as {
      customerPayload: { saleschannelCustomerEmail: string };
      previousSaleschannelCustomerJwt?: string;
    };
    expect(body.customerPayload.saleschannelCustomerEmail).toBe(
      'token@example.com',
    );
    expect(body.previousSaleschannelCustomerJwt).toBe('guest-jwt');
  });
});
