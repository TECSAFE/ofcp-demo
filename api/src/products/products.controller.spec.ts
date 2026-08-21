import { NotFoundException } from '@nestjs/common';
import { DUMMY_ITEM_COUNT } from './dummy-items';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  const controller = new ProductsController(new ProductsService());

  describe('tecsafeArticles', () => {
    it('returns every dummy item as a productNumber/price pair', () => {
      const { articles } = controller.tecsafeArticles();
      expect(articles).toHaveLength(DUMMY_ITEM_COUNT);
      expect(articles[0]).toEqual({ productNumber: 'OFCP-DUMMY-001', price: '1.00' });
    });

    it('formats price as a two-decimal string', () => {
      const { articles } = controller.tecsafeArticles();
      expect(articles.every((a) => /^\d+\.\d{2}$/.test(a.price))).toBe(true);
    });
  });

  describe('route ordering', () => {
    it('still resolves a dummy item by article number', () => {
      const { product } = controller.byArticleNumber('OFCP-DUMMY-001');
      expect(product.articleNumber).toBe('OFCP-DUMMY-001');
    });
  });

  describe('byEan', () => {
    it('resolves a dummy item by EAN', () => {
      const { product: dummy } = controller.byArticleNumber('OFCP-DUMMY-001');
      const { product } = controller.byEan(dummy.ean);
      expect(product.articleNumber).toBe('OFCP-DUMMY-001');
    });

    it('throws NotFoundException for an unknown EAN', () => {
      expect(() => controller.byEan('0000000000000')).toThrow(NotFoundException);
    });
  });
});
