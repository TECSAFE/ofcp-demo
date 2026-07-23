import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-app';

type ConsentBody = {
  consent: {
    dataExchange: boolean;
    tracking: boolean;
    updatedAt: string;
  };
};

describe('consent (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects guests', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get('/consent').expect(401);
    await agent
      .put('/consent')
      .send({ dataExchange: true, tracking: true })
      .expect(401);
  });

  it('stores consent at registration and restores it after a fresh login', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({
        email: 'consent@example.com',
        password: 'secret1',
        consent: {
          dataExchange: true,
          tracking: false,
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      })
      .expect(201);

    const res = await agent.get('/consent').expect(200);
    const resBody = res.body as ConsentBody;
    expect(resBody.consent).toEqual({
      dataExchange: true,
      tracking: false,
      updatedAt: '2026-07-20T00:00:00.000Z',
    });

    // A different browser (fresh agent = new guest session) logs in:
    // the stored consent must be restorable from the server.
    const otherBrowser = request.agent(app.getHttpServer());
    await otherBrowser
      .post('/auth/login')
      .send({ email: 'consent@example.com', password: 'secret1' })
      .expect(200);
    const restored = await otherBrowser.get('/consent').expect(200);
    const restoredBody = restored.body as ConsentBody;
    expect(restoredBody.consent.dataExchange).toBe(true);
  });

  it('updates consent via PUT', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ email: 'update@example.com', password: 'secret1' })
      .expect(201);

    const initial = (await agent.get('/consent').expect(200)).body as {
      consent: unknown;
    };
    expect(initial.consent).toBeNull();

    const put = await agent
      .put('/consent')
      .send({ dataExchange: true, tracking: true })
      .expect(200);
    const putBody = put.body as ConsentBody;
    expect(putBody.consent.dataExchange).toBe(true);
    expect(putBody.consent.updatedAt).toEqual(expect.any(String));

    const after = (await agent.get('/consent').expect(200)).body as ConsentBody;
    expect(after.consent.tracking).toBe(true);
  });
});
