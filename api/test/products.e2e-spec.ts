import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-app';

describe('products (e2e)', () => {
  let app: INestApplication;

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

  it('injects the 250 dummy items with ?includeDummyItems=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?includeDummyItems=true')
      .expect(200);
    const listBody = res.body as { products: Array<{ articleNumber: string }> };
    const dummies = listBody.products.filter((p) =>
      p.articleNumber.startsWith('OFCP-DUMMY-'),
    );
    expect(dummies).toHaveLength(250);
  });

  it('serves a dummy item by article number like any product', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/OFCP-DUMMY-042')
      .expect(200);
    const productBody = res.body as { product: { price: number; ean: string } };
    expect(productBody.product.price).toBe(42);
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
