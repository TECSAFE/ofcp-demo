import { ConfigService } from '../shared/config/config.service';
import { DEMO_PRODUCTS } from './products.data';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const service = new ProductsService(new ConfigService());

  it('lists at least three demo products', () => {
    expect(service.list().length).toBeGreaterThanOrEqual(3);
  });

  it('finds a product by article number', () => {
    const product = service.byArticleNumber('5054598');
    expect(product?.name).toBeTruthy();
    expect(product?.ean).toBeTruthy();
  });

  it('returns null for unknown article numbers', () => {
    expect(service.byArticleNumber('NOPE')).toBeNull();
  });

  it('hides dummy items from the default listing', () => {
    const articleNumbers = service.list().map((p) => p.articleNumber);
    expect(articleNumbers.some((a) => a.startsWith('OFCP-DUMMY-'))).toBe(false);
  });

  it('injects the dummy items when asked to', () => {
    const products = service.list({ includeDummyItems: true });
    expect(products).toHaveLength(
      DEMO_PRODUCTS.length + service.listTecsafeArticles().length,
    );
    // Regular catalog first, dummy items appended.
    expect(products[DEMO_PRODUCTS.length].articleNumber).toBe('OFCP-DUMMY-001');
  });

  it('always resolves dummy items by article number', () => {
    const product = service.byArticleNumber('OFCP-DUMMY-042');
    expect(product?.price).toBeGreaterThan(1);
    expect(product?.stock).toBeGreaterThan(0);
  });

  it('lists the TECSAFE dummy-item catalog as productNumber/price pairs', () => {
    const articles = service.listTecsafeArticles();
    expect(articles.length).toBeGreaterThan(0);
    expect(articles[0]).toEqual({
      productNumber: 'OFCP-DUMMY-001',
      price: '1.00',
    });
  });

  it('resolves a product by EAN', () => {
    const dummy = service.byArticleNumber('OFCP-DUMMY-042');
    expect(service.byEan(dummy!.ean)?.articleNumber).toBe('OFCP-DUMMY-042');
  });

  it('returns null for an unknown EAN', () => {
    expect(service.byEan('0000000000000')).toBeNull();
  });
});
