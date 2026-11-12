import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-app';

/** Decodes the form body of a mocked token request. */
const formOf = (call: unknown[]): Record<string, string> =>
  Object.fromEntries(
    new URLSearchParams((call[1] as { body: string }).body).entries(),
  );

describe('tecsafe token (e2e)', () => {
  let app: INestApplication;
  const fetchMock = jest.fn();

  beforeAll(async () => {
    app = await createTestApp();
    global.fetch = fetchMock;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    // Authentik's token endpoint answers both the shop login (username/password)
    // and the customer exchange (client_assertion); tell them apart by the form.
    fetchMock.mockImplementation((_url: string, init: { body: string }) => {
      const form = new URLSearchParams(init.body);
      const isLogin = form.has('username');
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            access_token: isLogin ? 'sc-token' : 'customer-token',
            token_type: 'Bearer',
            expires_in: isLogin ? 900 : 300,
            scope: 'ofcp',
          }),
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const customerCall = () =>
    fetchMock.mock.calls.find(
      (call) => 'client_assertion' in formOf(call as unknown[]),
    ) as unknown[] | undefined;

  it('mints a guest token for anonymous sessions', async () => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/tecsafe/token')
      .send({ oldToken: 'old-jwt' })
      .expect(200);
    const resBody = res.body as { token: string };
    expect(resBody.token).toBe('customer-token');

    const form = formOf(customerCall()!);
    expect(form.client_assertion).toBe('sc-token');
    const customer = JSON.parse(form.ofcp_customer) as {
      customerPayload?: unknown;
      previousSaleschannelCustomerJwt?: string;
    };
    expect(customer.customerPayload).toBeUndefined();
    expect(customer.previousSaleschannelCustomerJwt).toBe('old-jwt');
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

    const customer = JSON.parse(formOf(customerCall()!).ofcp_customer) as {
      customerPayload: { saleschannelCustomerEmail: string };
      previousSaleschannelCustomerJwt?: string;
    };
    expect(customer.customerPayload.saleschannelCustomerEmail).toBe(
      'token@example.com',
    );
    expect(customer.previousSaleschannelCustomerJwt).toBe('guest-jwt');
  });
});
