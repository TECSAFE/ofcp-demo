export type CartItem = {
  articleNumber: string;
  quantity: number;
  /** Present when the item was configured through the TECSAFE widget. */
  configurationId?: string;
};

export type CartRecord = {
  sid: string;
  items: CartItem[];
};

export type EnrichedCartItem = CartItem & {
  name: string;
  unitPrice: number;
  lineTotal: number;
};

export type CartView = {
  items: EnrichedCartItem[];
  total: number;
};
