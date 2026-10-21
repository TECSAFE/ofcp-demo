import { describe, expect, it, vi } from 'vitest';
import type { CartPunchoutRequest } from '@tecsafe/widget-sdk';
import {
  fetchProductByIdentifier,
  respondToCartPunchoutRequest,
} from '../app/composables/useTecsafe';

describe('article identifier lookup', () => {
  it.each([
    [{ gtin: '4014549900010' }, '/products/ean/4014549900010'],
    [{ supplierArticleNumber: 'SKU/123' }, '/products/SKU%2F123'],
    [{ manufacturerArticleNumber: 'SKU-123' }, '/products/SKU-123'],
  ])('resolves %j through the product API', async (identifier, url) => {
    const product = { articleNumber: 'SKU-123' };
    const api = vi.fn().mockResolvedValue({ product });
    expect(await fetchProductByIdentifier(api, identifier)).toEqual(product);
    expect(api).toHaveBeenCalledWith(url);
  });

  it('falls back through missing article numbers to GTIN', async () => {
    const product = { articleNumber: 'OFCP-DUMMY-001' };
    const api = vi.fn(async (url: string) => {
      if (url === '/products/ean/4014549900010') return { product };
      throw Object.assign(new Error('Not found'), { statusCode: 404 });
    });
    expect(
      await fetchProductByIdentifier(api, {
        manufacturerArticleNumber: 'MANUFACTURER-001',
        supplierArticleNumber: 'SUPPLIER-001',
        gtin: '4014549900010',
      }),
    ).toEqual(product);
    expect(api.mock.calls.map(([url]) => url)).toEqual([
      '/products/MANUFACTURER-001',
      '/products/SUPPLIER-001',
      '/products/ean/4014549900010',
    ]);
  });

  it('stops at the first match and returns null when every identifier is missing', async () => {
    const product = { articleNumber: 'SHOP-001' };
    const api = vi.fn().mockRejectedValueOnce({ statusCode: 404 }).mockResolvedValue({ product });
    const identifier = {
      manufacturerArticleNumber: 'MISSING',
      supplierArticleNumber: 'SHOP-001',
      gtin: '4014549900010',
    };
    expect(await fetchProductByIdentifier(api, identifier)).toEqual(product);
    expect(api).toHaveBeenCalledTimes(2);

    const missing = vi.fn().mockRejectedValue({ response: { status: 404 } });
    expect(await fetchProductByIdentifier(missing, identifier)).toBeNull();
  });

  it('preserves transport and server errors instead of treating them as missing products', async () => {
    for (const error of [new Error('Network unavailable'), { statusCode: 503 }]) {
      const api = vi.fn().mockRejectedValue(error);
      await expect(
        fetchProductByIdentifier(api, { manufacturerArticleNumber: 'SKU', gtin: '123' }),
      ).rejects.toBe(error);
      expect(api).toHaveBeenCalledTimes(1);
    }
  });
});

describe('cart punchout response', () => {
  const request: CartPunchoutRequest = { positions: [], tecsafeTotal: 0 };

  it('waits for the complete cart transfer before reporting success', async () => {
    let accept!: (success: boolean) => void;
    const transfer = new Promise<boolean>((resolve) => {
      accept = resolve;
    });
    const respond = vi.fn();
    const pending = respondToCartPunchoutRequest(request, () => transfer, respond);
    expect(respond).not.toHaveBeenCalled();
    accept(true);
    await pending;
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: true });
  });

  it.each(['rejected', 'transport error'])('reports failure for a %s transfer', async (failure) => {
    const respond = vi.fn();
    await respondToCartPunchoutRequest(
      request,
      async () => {
        if (failure === 'transport error') throw new Error('offline');
        return false;
      },
      respond,
    );
    expect(respond).toHaveBeenCalledExactlyOnceWith({ success: false });
  });
});
