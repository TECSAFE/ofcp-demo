import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-app';

describe('sessions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('issues a sid cookie on first contact and keeps it stable afterwards', async () => {
    const agent = request.agent(app.getHttpServer());

    const first = await agent.get('/').expect(200);
    const setCookie = (first.headers['set-cookie'] ??
      []) as unknown as string[];
    expect(setCookie.some((c) => c.startsWith('sid='))).toBe(true);

    const second = await agent.get('/').expect(200);
    expect(second.headers['set-cookie']).toBeUndefined();
  });
});
