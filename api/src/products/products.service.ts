import { Injectable } from '@nestjs/common';
import { generateDummyItems } from './dummy-items';
import { ConfigService } from '../shared/config/config.service';
import { Product } from './product.types';
import { DEMO_PRODUCTS } from './products.data';

@Injectable()
export class ProductsService {
  private readonly dummyItems: Product[];

  constructor(config: ConfigService) {
    this.dummyItems = generateDummyItems({
      startPrice: config.DUMMY_ITEM_START_PRICE,
      increasePercent: config.DUMMY_ITEM_INCREASE_PERCENT,
      endPrice: config.DUMMY_ITEM_END_PRICE,
    });
  }
  /**
   * Dummy items are hidden from the normal overview/search — a real shop
   * never lists them. The flag exists only so the demo can fake the
   * "installed" state and show visitors what the generated items look like.
   */
  list(options: { includeDummyItems?: boolean } = {}): Product[] {
    return options.includeDummyItems
      ? [...DEMO_PRODUCTS, ...this.dummyItems]
      : DEMO_PRODUCTS;
  }

  /** Dummy items are always addressable by itemId — that is the contract. */
  byArticleNumber(articleNumber: string): Product | null {
    return (
      DEMO_PRODUCTS.find((p) => p.articleNumber === articleNumber) ??
      this.dummyItems.find((p) => p.articleNumber === articleNumber) ??
      null
    );
  }

  byEan(ean: string): Product | null {
    return (
      DEMO_PRODUCTS.find((p) => p.ean === ean) ??
      this.dummyItems.find((p) => p.ean === ean) ??
      null
    );
  }

  /** The shop's TECSAFE article catalog, in the shape the widget SDK expects. */
  listTecsafeArticles(): { productNumber: string; price: string }[] {
    return this.dummyItems.map((item) => ({
      productNumber: item.articleNumber,
      price: item.price.toFixed(2),
    }));
  }
}
