/** Clamp arbitrary quantity input to a sane cart quantity: integer >= 1. */
export function sanitizeQuantity(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
