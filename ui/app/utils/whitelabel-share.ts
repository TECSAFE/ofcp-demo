import { isHexColor, type WhitelabelSettings } from './whitelabel';

export const SHARE_QUERY_PARAM = 'wl';

export type ShareLogo = { type: string; base64: string };

export type WhitelabelSharePayload = {
  settings: Omit<WhitelabelSettings, 'updatedAt'>;
  logo: ShareLogo | null;
};

export async function blobToShareLogo(blob: Blob): Promise<ShareLogo> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000; // String.fromCharCode argument limit safety
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { type: blob.type, base64: btoa(binary) };
}

export function shareLogoToBlob(logo: ShareLogo): Blob {
  const binary = atob(logo.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: logo.type });
}

export function parseSharePayload(data: unknown): WhitelabelSharePayload | null {
  if (typeof data !== 'object' || data === null) return null;
  const { settings, logo } = data as { settings?: unknown; logo?: unknown };
  if (typeof settings !== 'object' || settings === null) return null;
  const s = settings as Record<string, unknown>;
  if (typeof s.shopName !== 'string' || s.shopName.trim() === '') return null;
  if (!isHexColor(s.primaryColor) || !isHexColor(s.surfaceColor)) return null;
  const debugWidget = typeof s.debugWidget === 'boolean' ? s.debugWidget : false;

  let parsedLogo: ShareLogo | null = null;
  if (logo !== null && logo !== undefined) {
    const l = logo as Record<string, unknown>;
    if (typeof l.type !== 'string' || !l.type.startsWith('image/')) return null;
    if (typeof l.base64 !== 'string' || l.base64 === '') return null;
    parsedLogo = { type: l.type, base64: l.base64 };
  }

  return {
    settings: {
      shopName: s.shopName.trim(),
      primaryColor: s.primaryColor,
      surfaceColor: s.surfaceColor,
      debugWidget,
    },
    logo: parsedLogo,
  };
}

export function buildShareLink(origin: string, id: string): string {
  return `${origin}/?${SHARE_QUERY_PARAM}=${encodeURIComponent(id)}`;
}

export function shareIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get(SHARE_QUERY_PARAM);
  return id && id.trim() !== '' ? id : null;
}
