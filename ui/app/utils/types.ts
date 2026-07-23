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
};

export type CartView = {
  items: Array<CartItem & { name: string; unitPrice: number; lineTotal: number }>;
  total: number;
};
