import { Injectable } from '@nestjs/common';
import { FileStoreService } from '../file-store/file-store.service';
import { ProductsService } from '../products/products.service';
import { CartItem, CartRecord, CartView } from './cart.types';

const sameLine = (a: CartItem, b: CartItem): boolean =>
  a.articleNumber === b.articleNumber &&
  (a.configurationId ?? '') === (b.configurationId ?? '');

@Injectable()
export class CartService {
  constructor(
    private readonly store: FileStoreService,
    private readonly products: ProductsService,
  ) {}

  async addItem(sid: string, item: CartItem): Promise<void> {
    await this.store.update<CartRecord[]>('carts', [], (carts) => {
      const cart = carts.find((c) => c.sid === sid) ?? { sid, items: [] };
      const existing = cart.items.find((i) => sameLine(i, item));
      const items = existing
        ? cart.items.map((i) =>
            sameLine(i, item)
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          )
        : [...cart.items, item];
      return [...carts.filter((c) => c.sid !== sid), { sid, items }];
    });
  }

  async getCart(sid: string): Promise<CartView> {
    const carts = await this.store.read<CartRecord[]>('carts', []);
    const cart = carts.find((c) => c.sid === sid) ?? { sid, items: [] };
    const items = cart.items.map((item) => {
      const product = this.products.byArticleNumber(item.articleNumber);
      const unitPrice = product?.price ?? 0;
      return {
        ...item,
        name: product?.name ?? item.articleNumber,
        unitPrice,
        lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
      };
    });
    return {
      items,
      total:
        Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100,
    };
  }

  async clear(sid: string): Promise<void> {
    await this.store.update<CartRecord[]>('carts', [], (carts) =>
      carts.filter((c) => c.sid !== sid),
    );
  }
}
