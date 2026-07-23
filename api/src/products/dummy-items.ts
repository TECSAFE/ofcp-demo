import { Product } from './product.types';

/**
 * Every shop that integrates OFCP is expected to provide 250 dummy items
 * (or one item with 250 variants) that TECSAFE can address by itemId.
 * They are normally invisible in the shop's search and product overview;
 * this demo has no real installation process, so they are generated
 * in-memory and can be injected into the normal listing on demand.
 */
export const DUMMY_ITEM_COUNT = 250;
export const DUMMY_ARTICLE_PREFIX = 'OFCP-DUMMY-';

/** GS1 check digit: alternating 1/3 weights over the 12-digit body. */
function ean13CheckDigit(body: string): string {
  const sum = body
    .split('')
    .reduce((acc, digit, i) => acc + Number(digit) * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

function dummyItem(n: number): Product {
  const id = String(n).padStart(3, '0');
  const eanBody = `40145499${String(n).padStart(4, '0')}`;
  return {
    articleNumber: `${DUMMY_ARTICLE_PREFIX}${id}`,
    ean: eanBody + ean13CheckDigit(eanBody),
    name: `OFCP Dummy Item ${id}`,
    price: n,
    stock: 999,
    description:
      `OFCP dummy item #${id} (${n} EUR). One of the ${DUMMY_ITEM_COUNT} ` +
      'placeholder items every OFCP shop provides so TECSAFE can address ' +
      'them by itemId. Not part of the regular catalog.',
  };
}

export const DUMMY_ITEMS: Product[] = Array.from(
  { length: DUMMY_ITEM_COUNT },
  (_, i) => dummyItem(i + 1),
);
