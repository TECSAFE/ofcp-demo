export type Product = {
  articleNumber: string;
  ean: string;
  name: string;
  /** Gross unit price in EUR. */
  price: number;
  /** 0 = out of stock; the SDK receives this as availableStock: false. */
  stock: number;
  description: string;
};
