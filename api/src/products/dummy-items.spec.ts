import {
  DUMMY_ARTICLE_PREFIX,
  DUMMY_ITEM_COUNT,
  DUMMY_ITEMS,
} from './dummy-items';

describe('DUMMY_ITEMS', () => {
  it('generates exactly 250 items', () => {
    expect(DUMMY_ITEM_COUNT).toBe(250);
    expect(DUMMY_ITEMS).toHaveLength(250);
  });

  it('numbers items OFCP-DUMMY-001 through OFCP-DUMMY-250', () => {
    expect(DUMMY_ITEMS[0].articleNumber).toBe('OFCP-DUMMY-001');
    expect(DUMMY_ITEMS[249].articleNumber).toBe('OFCP-DUMMY-250');
    for (const item of DUMMY_ITEMS) {
      expect(item.articleNumber.startsWith(DUMMY_ARTICLE_PREFIX)).toBe(true);
    }
  });

  it('prices item N at exactly N euros (1-250, 1 EUR steps)', () => {
    DUMMY_ITEMS.forEach((item, i) => expect(item.price).toBe(i + 1));
  });

  it('gives every item a unique, valid 13-digit EAN', () => {
    const eans = new Set(DUMMY_ITEMS.map((item) => item.ean));
    expect(eans.size).toBe(DUMMY_ITEM_COUNT);
    for (const ean of eans) {
      expect(ean).toMatch(/^\d{13}$/);
      // GS1 check digit: weighted sum of all 13 digits must be divisible by 10.
      const sum = ean
        .split('')
        .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
      expect(sum % 10).toBe(0);
    }
  });

  it('keeps items purchasable and self-describing', () => {
    for (const item of DUMMY_ITEMS) {
      expect(item.stock).toBeGreaterThan(0);
      expect(item.name).toContain('Dummy');
      expect(item.description.length).toBeGreaterThan(0);
    }
  });
});
