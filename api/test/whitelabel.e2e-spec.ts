import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './create-app';

const SECRET = 'e2e-test-secret';

const validBody = () => ({
  secret: SECRET,
  durationDays: 7,
  settings: {
    shopName: 'ACME Tools',
    primaryColor: '#b91c1c',
    surfaceColor: '#fde68a',
    debugWidget: true,
  },
  logo: {
    type: 'image/png',
    base64: Buffer.from('fake-png-bytes').toString('base64'),
  },
});

describe('whitelabel shares (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.WHITELABEL_SHARE_SECRET = SECRET;
    app = await createTestApp();
  });

  afterAll(async () => {
    delete process.env.WHITELABEL_SHARE_SECRET;
    await app.close();
  });

  it('returns 503 when sharing is not configured', async () => {
    delete process.env.WHITELABEL_SHARE_SECRET;
    try {
      await request(app.getHttpServer())
        .post('/whitelabel-shares')
        .send(validBody())
        .expect(503);
    } finally {
      process.env.WHITELABEL_SHARE_SECRET = SECRET;
    }
  });

  it('returns 401 for a wrong secret', async () => {
    await request(app.getHttpServer())
      .post('/whitelabel-shares')
      .send({ ...validBody(), secret: 'wrong' })
      .expect(401);
  });

  it('validates the payload', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/whitelabel-shares')
      .send({
        ...validBody(),
        settings: { ...validBody().settings, primaryColor: 'red' },
      })
      .expect(400);
    await request(server)
      .post('/whitelabel-shares')
      .send({ ...validBody(), durationDays: 0 })
      .expect(400);
    await request(server)
      .post('/whitelabel-shares')
      .send({ ...validBody(), durationDays: 31 })
      .expect(400);
    await request(server)
      .post('/whitelabel-shares')
      .send({
        ...validBody(),
        settings: { ...validBody().settings, shopName: '   ' },
      })
      .expect(400);
    await request(server)
      .post('/whitelabel-shares')
      .send({
        ...validBody(),
        logo: { type: 'application/pdf', base64: 'aGVsbG8=' },
      })
      .expect(400);
    // 699051 groups of 4 chars, no padding -> 2 MB + 1 byte decoded.
    await request(server)
      .post('/whitelabel-shares')
      .send({
        ...validBody(),
        logo: { type: 'image/png', base64: 'A'.repeat(699051 * 4) },
      })
      .expect(400);
    await request(server)
      .post('/whitelabel-shares')
      .send({
        ...validBody(),
        settings: { ...validBody().settings, debugWidget: 'yes' },
      })
      .expect(400);
  });

  it('round-trips a share, trimming the shop name', async () => {
    const server = app.getHttpServer();
    const body = validBody();
    body.settings.shopName = '  ACME Tools  ';
    const created = await request(server)
      .post('/whitelabel-shares')
      .send(body)
      .expect(201);
    const createdBody = created.body as { id: string; expiresAt: string };
    expect(createdBody).toEqual({
      id: expect.any(String) as unknown,
      expiresAt: expect.any(String) as unknown,
    });

    const fetched = await request(server)
      .get(`/whitelabel-shares/${createdBody.id}`)
      .expect(200);
    expect(fetched.body).toEqual({
      settings: {
        shopName: 'ACME Tools',
        primaryColor: '#b91c1c',
        surfaceColor: '#fde68a',
        debugWidget: true,
      },
      logo: validBody().logo,
      expiresAt: createdBody.expiresAt,
    });
  });

  it('accepts a logo bigger than the express default 100 kB body limit', async () => {
    // 100000 groups of 4 chars -> 300 kB decoded, ~400 kB JSON body.
    const created = await request(app.getHttpServer())
      .post('/whitelabel-shares')
      .send({
        ...validBody(),
        logo: { type: 'image/png', base64: 'A'.repeat(100000 * 4) },
      })
      .expect(201);
    const createdBody = created.body as { id: string };
    expect(createdBody.id).toEqual(expect.any(String));
  });

  it('stores shares without a logo', async () => {
    const withoutLogo: Record<string, unknown> = { ...validBody() };
    delete withoutLogo.logo;
    const created = await request(app.getHttpServer())
      .post('/whitelabel-shares')
      .send(withoutLogo)
      .expect(201);
    const createdBody = created.body as { id: string };
    const fetched = await request(app.getHttpServer())
      .get(`/whitelabel-shares/${createdBody.id}`)
      .expect(200);
    const fetchedBody = fetched.body as { logo: unknown };
    expect(fetchedBody.logo).toBeNull();
  });

  it('returns 404 for unknown share ids', async () => {
    await request(app.getHttpServer())
      .get('/whitelabel-shares/unknown-id')
      .expect(404);
  });
});
