import { generateDummyItems } from './dummy-items';

describe('generateDummyItems', () => {
  it('compounds the percentage and includes an exact end price', () => {
    const items = generateDummyItems({
      startPrice: 10,
      increasePercent: 50,
      endPrice: 33.75,
    });
    expect(items.map((item) => item.price)).toEqual([10, 15, 22.5, 33.75]);
    expect(items.map((item) => item.articleNumber)).toEqual([
      'OFCP-DUMMY-001',
      'OFCP-DUMMY-002',
      'OFCP-DUMMY-003',
      'OFCP-DUMMY-004',
    ]);
  });

  it('rounds each step to cents and stops before exceeding the end price', () => {
    const items = generateDummyItems({
      startPrice: 1.01,
      increasePercent: 10,
      endPrice: 1.35,
    });
    expect(items.map((item) => item.price)).toEqual([1.01, 1.11, 1.22, 1.34]);
  });

  it('allows a single-price catalog', () => {
    expect(
      generateDummyItems({
        startPrice: 12,
        increasePercent: 5,
        endPrice: 12,
      }).map((item) => item.price),
    ).toEqual([12]);
  });

  it.each([
    { startPrice: 0, increasePercent: 5, endPrice: 10 },
    { startPrice: 1, increasePercent: 0, endPrice: 10 },
    { startPrice: 1, increasePercent: -1, endPrice: 10 },
    { startPrice: 10, increasePercent: 5, endPrice: 1 },
    { startPrice: NaN, increasePercent: 5, endPrice: 10 },
    { startPrice: 1, increasePercent: Infinity, endPrice: 10 },
    { startPrice: 1, increasePercent: 0.001, endPrice: 10 },
    { startPrice: 1.001, increasePercent: 10, endPrice: 10 },
    { startPrice: 1, increasePercent: 1, endPrice: Infinity },
    { startPrice: 100, increasePercent: 0.01, endPrice: 100000 },
  ])('rejects invalid or impractical price ranges: %j', (settings) => {
    expect(() => generateDummyItems(settings)).toThrow();
  });

  it('creates addressable items with unique valid EANs and their actual price in the description', () => {
    const items = generateDummyItems({
      startPrice: 5,
      increasePercent: 10,
      endPrice: 500,
    });
    expect(new Set(items.map((item) => item.ean)).size).toBe(items.length);
    for (const item of items) {
      expect(item.ean).toMatch(/^\d{13}$/);
      const sum = [...item.ean].reduce(
        (total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 1 : 3),
        0,
      );
      expect(sum % 10).toBe(0);
      expect(item.stock).toBeGreaterThan(0);
      expect(item.description).toContain(item.price.toFixed(2));
    }
  });
});
