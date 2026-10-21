import type { CartPunchoutPosition } from '@tecsafe/widget-sdk';

export type Product = {
  articleNumber: string;
  ean: string;
  name: string;
  /** Gross unit price in EUR. */
  price: number;
  /** 0 = out of stock. */
  stock: number;
  description: string;
};

export type AuthUser = {
  id: string;
  email: string;
};

export type CartItem = {
  articleNumber: string;
  quantity: number;
  configurationId?: string;
  punchout?: {
    transferId: string;
    position: CartPunchoutPosition;
    tecsafeTotal: number;
  };
};

export type CartView = {
  items: Array<CartItem & { name: string; unitPrice: number; lineTotal: number }>;
  total: number;
};
