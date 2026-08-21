import { describe, expect, it, vi } from 'vitest';
import { respondToArticleInfoRequest } from '../app/composables/useTecsafe';

const product = {
  articleNumber: 'OFCP-DUMMY-001',
  ean: '4014549900010',
  name: 'OFCP Dummy Item 001',
  price: 1,
  stock: 999,
  description: 'dummy',
};

describe('respondToArticleInfoRequest', () => {
  it('answers once per requested identifier, echoing it back', async () => {
    const identifiers = [
      { manufacturerArticleNumber: 'OFCP-DUMMY-001' },
      { ean: '4014549900010' },
      { manufacturerArticleNumber: 'UNKNOWN' },
    ];
    const fetchProduct = vi.fn(async (id: (typeof identifiers)[number]) =>
      'manufacturerArticleNumber' in id && id.manufacturerArticleNumber === 'UNKNOWN'
        ? null
        : product,
    );
    const respond = vi.fn();

    await respondToArticleInfoRequest(identifiers, fetchProduct, respond);

    expect(respond).toHaveBeenCalledTimes(3);
    identifiers.forEach((identifier) => {
      expect(respond).toHaveBeenCalledWith(expect.objectContaining({ article: identifier }));
    });
  });

  it('returns product info with a two-decimal string price for a resolvable identifier', async () => {
    const respond = vi.fn();

    await respondToArticleInfoRequest(
      [{ manufacturerArticleNumber: 'OFCP-DUMMY-001' }],
      async () => product,
      respond,
    );

    expect(respond).toHaveBeenCalledWith({
      article: { manufacturerArticleNumber: 'OFCP-DUMMY-001' },
      info: {
        articleNumber: 'OFCP-DUMMY-001',
        name: 'OFCP Dummy Item 001',
        price: '1.00',
        stock: 999,
        description: 'dummy',
      },
    });
  });

  it('answers an unresolvable identifier with info: null', async () => {
    const respond = vi.fn();

    await respondToArticleInfoRequest([{ ean: '0000000000000' }], async () => null, respond);

    expect(respond).toHaveBeenCalledWith({
      article: { ean: '0000000000000' },
      info: null,
    });
  });

  it('still answers the other identifiers when one lookup throws', async () => {
    const identifiers = [
      { manufacturerArticleNumber: 'OFCP-DUMMY-001' },
      { manufacturerArticleNumber: 'BROKEN' },
    ];
    const fetchProduct = vi.fn(async (id: (typeof identifiers)[number]) => {
      if ('manufacturerArticleNumber' in id && id.manufacturerArticleNumber === 'BROKEN') {
        throw new Error('boom');
      }
      return product;
    });
    const respond = vi.fn();

    await respondToArticleInfoRequest(identifiers, fetchProduct, respond);

    expect(respond).toHaveBeenCalledTimes(2);
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        article: { manufacturerArticleNumber: 'BROKEN' },
        info: null,
      }),
    );
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        article: { manufacturerArticleNumber: 'OFCP-DUMMY-001' },
        info: expect.objectContaining({ name: product.name }),
      }),
    );
  });
});
