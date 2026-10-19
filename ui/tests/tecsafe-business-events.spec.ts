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
