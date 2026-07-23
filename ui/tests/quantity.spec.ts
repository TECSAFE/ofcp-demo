import { describe, expect, it } from 'vitest';
import { sanitizeQuantity } from '../app/utils/quantity';

describe('sanitizeQuantity', () => {
  it('keeps positive integers', () => {
    expect(sanitizeQuantity(3)).toBe(3);
  });
  it('floors fractional input', () => {
    expect(sanitizeQuantity(2.7)).toBe(2);
  });
  it('coerces numeric strings', () => {
    expect(sanitizeQuantity('4')).toBe(4);
  });
  it('falls back to 1 for zero, negatives, NaN, empty and nonsense', () => {
    for (const bad of [0, -2, NaN, '', 'abc', null, undefined]) {
      expect(sanitizeQuantity(bad)).toBe(1);
    }
  });
});
