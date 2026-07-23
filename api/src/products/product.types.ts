export type Product = {
  articleNumber: string;
  ean: string;
  name: string;
  /** Gross unit price in EUR. */
  price: number;
  /** 0 = out of stock (matches the widget SDK's ArticleInfo semantics). */
  stock: number;
  description: string;
};
