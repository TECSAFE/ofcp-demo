import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-app';

describe('cart (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('adds, lists and clears items on the session cart', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent
      .post('/cart/items')
      .send({ articleNumber: '5054598', quantity: 1, configurationId: 'cfg-1' })
      .expect(201);
    await agent
      .post('/cart/items')
      .send({ articleNumber: 'TEST-123', quantity: 2 })
      .expect(201);

    const cart = await agent.get('/cart').expect(200);
    const cartBody = cart.body as {
      items: { configurationId?: string }[];
      total: number;
    };
    expect(cartBody.items).toHaveLength(2);
    expect(cartBody.total).toBeGreaterThan(0);
    expect(
      cartBody.items.find((i) => i.configurationId === 'cfg-1'),
    ).toBeTruthy();

    await agent.delete('/cart').expect(200);
    const cleared = (await agent.get('/cart').expect(200)).body as {
      items: unknown[];
    };
    expect(cleared.items).toHaveLength(0);
  });

  it('404s for unknown articles', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/cart/items')
      .send({ articleNumber: 'NOPE', quantity: 1 })
      .expect(404);
  });
});
