import { describe, expect, it } from 'vitest';
import { buildProxyTarget } from '../server/utils/proxy-target';

describe('buildProxyTarget', () => {
  it('joins base and path', () => {
    expect(buildProxyTarget('http://127.0.0.1:4000', 'products/123', '')).toBe(
      'http://127.0.0.1:4000/products/123',
    );
  });
  it('strips trailing slashes from the base', () => {
    expect(buildProxyTarget('http://127.0.0.1:4000///', 'cart', '')).toBe(
      'http://127.0.0.1:4000/cart',
    );
  });
  it('appends the query string verbatim', () => {
    expect(buildProxyTarget('http://api', 'products', '?limit=2&q=a')).toBe(
      'http://api/products?limit=2&q=a',
    );
  });
});
