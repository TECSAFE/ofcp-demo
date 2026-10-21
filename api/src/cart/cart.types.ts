import type { CartPunchoutPositionDto } from './cart-punchout.dto';

export type CartItem = {
  articleNumber: string;
  quantity: number;
  /** Present when the item was configured through the TECSAFE widget. */
  configurationId?: string;
  /** Original SDK position, scoped to its transfer so repeated layouts stay separate. */
  punchout?: {
    transferId: string;
    position: CartPunchoutPositionDto;
    tecsafeTotal: number;
  };
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
