import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './create-app';
import type { CartView } from '../src/cart/cart.types';

describe('cart (e2e)', () => {
  let app: INestApplication<App>;

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

  const layout = {
    positionId: 'layout-1',
    parentPositionId: null,
    type: 'layout',
    identifiers: { itemID: 'OFCP-DUMMY-001', itemHash: 'layout-hash' },
    description: { title: { 'de-DE': 'Mein Layout', 'en-US': 'My layout' } },
    quantity: {
      relation: 'independent',
      value: '2',
      total: '2',
      unitOfMeasure: 'PCE',
    },
    pricing: {
      unitPrice: '11.90',
      effectiveUnitPrice: '10.71',
      lineAmount: '21.42',
      allowancesAndCharges: [
        { reasonText: 'Discount', type: 'percentage', value: '10' },
      ],
    },
    taxCategory: 'S',
    meta: { material: { quality: 'test' }, itemCount: { test: 2 } },
  };
  const article = {
    ...layout,
    positionId: 'article-1',
    parentPositionId: 'layout-1',
    type: 'hostShopArticle',
    identifiers: { hostShopArticleNumber: '5054598', gtin: '4012345678901' },
    description: { title: { 'de-DE': 'Shopartikel' } },
    quantity: {
      relation: 'once-per-parent',
      value: '0.5',
      total: '0.5',
      unitOfMeasure: 'MTR',
    },
    pricing: {
      unitPrice: '2.00',
      effectiveUnitPrice: '2.00',
      lineAmount: '1.00',
      allowancesAndCharges: [],
    },
  };

  it('accepts complete punchouts and preserves positions, prices and quantities across repeated transfers', async () => {
    const agent = request.agent(app.getHttpServer());
    const punchout = { positions: [layout, article], tecsafeTotal: 22.42 };
    await agent
      .post('/cart/punchout')
      .send(punchout)
      .expect(201)
      .expect({ success: true });
    await agent.post('/cart/punchout').send(punchout).expect(201);
    await agent
      .post('/cart/items')
      .send({ articleNumber: '5054598', quantity: 1 })
      .expect(201);
    const response = await agent.get('/cart').expect(200);
    const cart = response.body as CartView;
    expect(cart.items).toHaveLength(5);
    expect(cart.items[0]).toMatchObject({
      name: 'Mein Layout',
      quantity: 2,
      unitPrice: 10.71,
      lineTotal: 21.42,
      punchout: { position: layout, tecsafeTotal: 22.42 },
    });
    expect(cart.items[1]).toMatchObject({
      articleNumber: '5054598',
      name: 'Shopartikel',
      quantity: 0.5,
      unitPrice: 2,
      lineTotal: 1,
      punchout: { position: article },
    });
    expect(cart.total).toBeCloseTo(44.84 + cart.items[4].lineTotal);
    const otherCart = (
      await request.agent(app.getHttpServer()).get('/cart').expect(200)
    ).body as CartView;
    expect(otherCart.items).toHaveLength(0);
    await agent.delete('/cart').expect(200);
    expect(((await agent.get('/cart')).body as CartView).items).toHaveLength(0);
  });

  it('accepts free positions and preserves extensible metadata and nullable text', async () => {
    const agent = request.agent(app.getHttpServer());
    const free = {
      ...layout,
      identifiers: { itemID: 'FREE', hostShopArticleNumber: null },
      description: { ...layout.description, description: { en: null } },
      pricing: {
        unitPrice: '0',
        effectiveUnitPrice: '0.00',
        lineAmount: '0',
        allowancesAndCharges: [],
      },
      meta: { custom: { nested: ['anything', 1] } },
    };
    await agent
      .post('/cart/punchout')
      .send({ positions: [free], tecsafeTotal: 0 })
      .expect(201);
    const cart = (await agent.get('/cart').expect(200)).body as CartView;
    expect(cart.items[0]).toMatchObject({
      articleNumber: 'FREE',
      lineTotal: 0,
      punchout: { position: free },
    });
  });

  it.each([
    { ...layout, identifiers: { hostShopArticleNumber: { nested: 'bad' } } },
    { ...layout, identifiers: { itemID: 123 } },
    { ...layout, description: { title: { en: { nested: 'bad' } } } },
    { ...layout, description: { title: { en: null } } },
    {
      ...layout,
      description: { ...layout.description, customerTitle: { en: 123 } },
    },
    {
      ...layout,
      description: { ...layout.description, description: { en: {} } },
    },
    ...['0', '0.00'].flatMap((zero) => [
      { ...layout, quantity: { ...layout.quantity, total: zero } },
      { ...layout, quantity: { ...layout.quantity, value: zero } },
    ]),
  ])('rejects invalid field values atomically: %j', async (invalid) => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/cart/punchout')
      .send({
        positions: [layout, { ...invalid, positionId: 'invalid' }],
        tecsafeTotal: 21.42,
      })
      .expect(400);
    expect(
      ((await agent.get('/cart').expect(200)).body as CartView).items,
    ).toHaveLength(0);
  });

  it.each([
    {
      positions: [{ ...layout, quantity: [layout.quantity] }],
      tecsafeTotal: 21.42,
    },
    { positions: [{ ...layout, description: [] }], tecsafeTotal: 21.42 },
    { positions: [{ ...layout, pricing: [] }], tecsafeTotal: 21.42 },
    {
      positions: [
        layout,
        { ...article, pricing: { ...article.pricing, lineAmount: 'NaN' } },
      ],
      tecsafeTotal: 22.42,
    },
    {
      positions: [
        layout,
        { ...article, quantity: { ...article.quantity, total: '-1' } },
      ],
      tecsafeTotal: 22.42,
    },
    {
      positions: [layout, { ...article, parentPositionId: 'missing' }],
      tecsafeTotal: 22.42,
    },
    { positions: [layout, layout], tecsafeTotal: 42.84 },
    { positions: [], tecsafeTotal: 0 },
  ])(
    'rejects an invalid punchout without adding any positions: %j',
    async (payload) => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/cart/punchout').send(payload).expect(400);
      const cart = (await agent.get('/cart').expect(200)).body as CartView;
      expect(cart.items).toHaveLength(0);
    },
  );
});
