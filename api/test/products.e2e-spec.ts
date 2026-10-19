import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp } from './create-app';

describe('products (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists products', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    const listBody = res.body as { products: unknown[] };
    expect(listBody.products.length).toBeGreaterThanOrEqual(3);
    expect(listBody.products[0]).toHaveProperty('articleNumber');
  });

  it('hides dummy items from the default listing', async () => {
    const res = await request(app.getHttpServer()).get('/products').expect(200);
    const listBody = res.body as { products: Array<{ articleNumber: string }> };
    expect(
      listBody.products.some((p) => p.articleNumber.startsWith('OFCP-DUMMY-')),
    ).toBe(false);
  });

  it('injects generated dummy items with ?includeDummyItems=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?includeDummyItems=true')
      .expect(200);
    const listBody = res.body as { products: Array<{ articleNumber: string }> };
    const dummies = listBody.products.filter((p) =>
      p.articleNumber.startsWith('OFCP-DUMMY-'),
    );
    const sdk = await request(app.getHttpServer())
      .get('/products/tecsafe-articles')
      .expect(200);
    expect(dummies.length).toBeGreaterThan(0);
    const sdkBody = sdk.body as { articles: unknown[] };
    expect(dummies.length).toBe(sdkBody.articles.length);
  });

  it('serves a dummy item by article number like any product', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/OFCP-DUMMY-042')
      .expect(200);
    const productBody = res.body as { product: { price: number; ean: string } };
    expect(productBody.product.price).toBeGreaterThan(1);
    expect(productBody.product.ean).toMatch(/^\d{13}$/);
  });

  it('returns one product with all article-info fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/5054598')
      .expect(200);
    const productBody = res.body as { product: unknown };
    const expected: Record<string, unknown> = {
      articleNumber: '5054598',
      ean: expect.any(String),
      name: expect.any(String),
      price: expect.any(Number),
      stock: expect.any(Number),
      description: expect.any(String),
    };
    expect(productBody.product).toMatchObject(expected);
  });

  it('404s for unknown articles', async () => {
    await request(app.getHttpServer()).get('/products/NOPE').expect(404);
  });
});

describe('environment-configured dummy catalog (e2e)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const keys = [
      'DUMMY_ITEM_START_PRICE',
      'DUMMY_ITEM_INCREASE_PERCENT',
      'DUMMY_ITEM_END_PRICE',
    ] as const;
    const saved = keys.map((key) => process.env[key]);
    try {
      process.env.DUMMY_ITEM_START_PRICE = '10';
      process.env.DUMMY_ITEM_INCREASE_PERCENT = '50';
      process.env.DUMMY_ITEM_END_PRICE = '33.75';
      app = await createTestApp();
    } finally {
      keys.forEach((key, i) => {
        if (saved[i] === undefined) delete process.env[key];
        else process.env[key] = saved[i];
      });
    }
  });
  afterAll(async () => {
    await app?.close();
  });

  it('uses the same configured catalog for listing, SDK, lookups and cart pricing', async () => {
    const agent = request.agent(app.getHttpServer());
    const listed = (
      await agent.get('/products?includeDummyItems=true').expect(200)
    ).body as {
      products: { articleNumber: string; price: number; ean: string }[];
    };
    const dummies = listed.products.filter((product) =>
      product.articleNumber.startsWith('OFCP-DUMMY-'),
    );
    expect(dummies.map((product) => product.price)).toEqual([
      10, 15, 22.5, 33.75,
    ]);
    const sdk = (await agent.get('/products/tecsafe-articles').expect(200))
      .body as { articles: { productNumber: string; price: string }[] };
    expect(sdk.articles).toEqual([
      { productNumber: 'OFCP-DUMMY-001', price: '10.00' },
      { productNumber: 'OFCP-DUMMY-002', price: '15.00' },
      { productNumber: 'OFCP-DUMMY-003', price: '22.50' },
      { productNumber: 'OFCP-DUMMY-004', price: '33.75' },
    ]);
    const found = (
      await agent.get(`/products/ean/${dummies[2].ean}`).expect(200)
    ).body as { product: { price: number } };
    expect(found.product.price).toBe(22.5);
    await agent.get('/products/OFCP-DUMMY-005').expect(404);
    await agent
      .post('/cart/items')
      .send({ articleNumber: 'OFCP-DUMMY-003', quantity: 2 })
      .expect(201);
    const cart = (await agent.get('/cart').expect(200)).body as {
      total: number;
    };
    expect(cart.total).toBe(45);
  });
});
