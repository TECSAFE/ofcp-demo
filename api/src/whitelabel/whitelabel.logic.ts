import { createHash, timingSafeEqual } from 'node:crypto';
import { WhitelabelShare, WhitelabelShareLogo } from './whitelabel.types';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_SHARE_DAYS = 30;

/** Timing-safe secret comparison; hashing first equalizes the lengths. */
export function secretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function decodedBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

export type LogoRejection = 'notImage' | 'notBase64' | 'tooLarge';

export function validateShareLogo(
  logo: WhitelabelShareLogo,
): LogoRejection | null {
  if (!logo.type.startsWith('image/')) return 'notImage';
  if (
    logo.base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(logo.base64)
  ) {
    return 'notBase64';
  }
  if (decodedBase64Bytes(logo.base64) > MAX_LOGO_BYTES) return 'tooLarge';
  return null;
}

export function isShareExpired(
  share: Pick<WhitelabelShare, 'expiresAt'>,
  now: number,
): boolean {
  const t = Date.parse(share.expiresAt);
  return !Number.isFinite(t) || t <= now;
}
