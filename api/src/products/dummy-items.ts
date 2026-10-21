import { Product } from './product.types';

/** Generated placeholders are hidden from the regular catalog but addressable by itemId. */
export const DUMMY_ARTICLE_PREFIX = 'OFCP-DUMMY-';
export type DummyItemSettings = {
  startPrice: number;
  increasePercent: number;
  endPrice: number;
};
export const DEFAULT_DUMMY_ITEM_SETTINGS: DummyItemSettings = {
  startPrice: 1,
  increasePercent: 5,
  endPrice: 250,
};

/** GS1 check digit: alternating 1/3 weights over the 12-digit body. */
function ean13CheckDigit(body: string): string {
  const sum = body
    .split('')
    .reduce((acc, digit, i) => acc + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

function dummyItem(n: number, price: number): Product {
  const id = String(n).padStart(3, '0');
  const eanBody = `40145499${String(n).padStart(4, '0')}`;
  return {
    articleNumber: `${DUMMY_ARTICLE_PREFIX}${id}`,
    ean: eanBody + ean13CheckDigit(eanBody),
    name: `OFCP Dummy Item ${id}`,
    price,
    stock: 999,
    description:
      `OFCP dummy item #${id} (${price.toFixed(2)} EUR). One of the generated ` +
      'placeholder items every OFCP shop provides so TECSAFE can address ' +
      'them by itemId. Not part of the regular catalog.',
  };
}

/** Each next price compounds the previous price, rounded to cents; the end price is a ceiling. */
export function generateDummyItems(settings: DummyItemSettings): Product[] {
  const { startPrice, increasePercent, endPrice } = settings;
  const cents = (value: number) => Math.round(value * 100);
  if (
    ![startPrice, increasePercent, endPrice].every(
      (value) => Number.isFinite(value) && value > 0,
    ) ||
    endPrice < startPrice ||
    !Number.isSafeInteger(cents(endPrice)) ||
    Math.abs(startPrice * 100 - cents(startPrice)) > 0.000001 ||
    Math.abs(endPrice * 100 - cents(endPrice)) > 0.000001 ||
    cents(startPrice) < 1
  ) {
    throw new Error(
      'Dummy prices must be positive amounts with at most two decimal places, end >= start, and increase > 0',
    );
  }
  const items: Product[] = [];
  for (let price = cents(startPrice); price <= cents(endPrice);) {
    // The EAN scheme reserves four digits for the item sequence.
    if (items.length >= 9999)
      throw new Error('Dummy item configuration exceeds 9999 items');
    items.push(dummyItem(items.length + 1, price / 100));
    if (price === cents(endPrice)) break;
    const next = Math.round(price * (1 + increasePercent / 100));
    if (next <= price)
      throw new Error(
        'Dummy percentage increase is too small to advance the price by a cent',
      );
    price = next;
  }
  return items;
}
