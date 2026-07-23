import { Injectable } from '@nestjs/common';
import { DUMMY_ITEMS } from './dummy-items';
import { Product } from './product.types';
import { DEMO_PRODUCTS } from './products.data';

@Injectable()
export class ProductsService {
  /**
   * Dummy items are hidden from the normal overview/search — a real shop
   * never lists them. The flag exists only so the demo can fake the
   * "installed" state and show visitors what the 250 items look like.
   */
  list(options: { includeDummyItems?: boolean } = {}): Product[] {
    return options.includeDummyItems
      ? [...DEMO_PRODUCTS, ...DUMMY_ITEMS]
      : DEMO_PRODUCTS;
  }

  /** Dummy items are always addressable by itemId — that is the contract. */
  byArticleNumber(articleNumber: string): Product | null {
    return (
      DEMO_PRODUCTS.find((p) => p.articleNumber === articleNumber) ??
      DUMMY_ITEMS.find((p) => p.articleNumber === articleNumber) ??
      null
    );
  }
}
