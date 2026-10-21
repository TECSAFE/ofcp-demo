import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FileStoreService } from '../file-store/file-store.service';
import { ProductsService } from '../products/products.service';
import { CartItem, CartRecord, CartView } from './cart.types';
import type { CartPunchoutDto } from './cart-punchout.dto';

const sameLine = (a: CartItem, b: CartItem): boolean =>
  !a.punchout &&
  !b.punchout &&
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
      if (item.punchout) {
        const position = item.punchout.position;
        const titles =
          position.description.customerTitle ?? position.description.title;
        return {
          ...item,
          name:
            titles['de-DE'] ??
            titles.de ??
            titles['en-US'] ??
            titles.en ??
            Object.values(titles).find((title) => typeof title === 'string') ??
            item.articleNumber,
          unitPrice: Number(position.pricing.effectiveUnitPrice),
          lineTotal: Number(position.pricing.lineAmount),
        };
      }
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

  async addPunchout(sid: string, request: CartPunchoutDto): Promise<void> {
    const positions = new Map(
      request.positions.map((position) => [position.positionId, position]),
    );
    if (positions.size !== request.positions.length) {
      throw new BadRequestException('Duplicate punchout position IDs');
    }
    for (const position of request.positions) {
      if (
        position.type === 'layout'
          ? position.parentPositionId !== null
          : positions.get(position.parentPositionId ?? '')?.type !== 'layout'
      ) {
        throw new BadRequestException('Invalid punchout parent position');
      }
    }
    const transferId = randomUUID();
    const items: CartItem[] = request.positions.map((position) => ({
      articleNumber:
        position.identifiers.hostShopArticleNumber ??
        position.identifiers.itemID ??
        position.positionId,
      quantity: Number(position.quantity.total),
      punchout: { transferId, position, tecsafeTotal: request.tecsafeTotal },
    }));
    // One store update accepts all positions together, including layout and service lines.
    await this.store.update<CartRecord[]>('carts', [], (carts) => {
      const cart = carts.find((entry) => entry.sid === sid) ?? {
        sid,
        items: [],
      };
      return [
        ...carts.filter((entry) => entry.sid !== sid),
        { sid, items: [...cart.items, ...items] },
      ];
    });
  }

  async clear(sid: string): Promise<void> {
    await this.store.update<CartRecord[]>('carts', [], (carts) =>
      carts.filter((c) => c.sid !== sid),
    );
  }
}
