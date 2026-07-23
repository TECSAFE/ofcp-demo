import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-app';

describe('auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs out, and logs back in on one session cookie', async () => {
    const agent = request.agent(app.getHttpServer());

    const reg = await agent
      .post('/auth/register')
      .send({
        email: 'jane@example.com',
        password: 'secret1',
        consent: {
          dataExchange: true,
          tracking: false,
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      })
      .expect(201);
    const regBody = reg.body as { user: { email: string } };
    expect(regBody.user.email).toBe('jane@example.com');

    const me1 = (await agent.get('/auth/me').expect(200)).body as {
      user: { email: string };
    };
    expect(me1.user.email).toBe('jane@example.com');

    await agent.post('/auth/logout').expect(200);
    const me2 = (await agent.get('/auth/me').expect(200)).body as {
      user: unknown;
    };
    expect(me2.user).toBeNull();

    await agent
      .post('/auth/login')
      .send({ email: 'jane@example.com', password: 'wrong' })
      .expect(401);
    await agent
      .post('/auth/login')
      .send({ email: 'jane@example.com', password: 'secret1' })
      .expect(200);
    const me3 = (await agent.get('/auth/me').expect(200)).body as {
      user: { email: string };
    };
    expect(me3.user.email).toBe('jane@example.com');
  });

  it('rejects duplicate registration', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'secret1' })
      .expect(201);
    await agent
      .post('/auth/register')
      .send({ email: 'dup@example.com', password: 'secret1' })
      .expect(409);
  });

  it('validates the request body', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);
  });
});
