import { describe, expect, it } from 'vitest';
import {
  SHARE_QUERY_PARAM,
  blobToShareLogo,
  buildShareLink,
  parseSharePayload,
  shareIdFromSearch,
  shareLogoToBlob,
} from '../app/utils/whitelabel-share';

const payload = (over: Record<string, unknown> = {}) => ({
  settings: {
    shopName: 'ACME Tools',
    primaryColor: '#b91c1c',
    surfaceColor: '#fde68a',
    debugWidget: true,
  },
  logo: { type: 'image/png', base64: 'aGVsbG8=' },
  expiresAt: '2026-07-28T00:00:00.000Z',
  ...over,
});

describe('blobToShareLogo / shareLogoToBlob', () => {
  it('round-trips arbitrary bytes with the MIME type', async () => {
    const bytes = new Uint8Array(1000).map((_, i) => i % 256);
    const logo = await blobToShareLogo(new Blob([bytes], { type: 'image/png' }));
    expect(logo.type).toBe('image/png');

    const blob = shareLogoToBlob(logo);
    expect(blob.type).toBe('image/png');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });

  it('produces plain base64 without a data: prefix', async () => {
    const logo = await blobToShareLogo(new Blob(['hello'], { type: 'image/svg+xml' }));
    expect(logo.base64).toBe('aGVsbG8=');
  });
});

describe('parseSharePayload', () => {
  it('accepts a valid payload and trims the shop name', () => {
    const parsed = parseSharePayload(
      payload({
        settings: {
          shopName: ' ACME ',
          primaryColor: '#b91c1c',
          surfaceColor: '#fde68a',
          debugWidget: true,
        },
      }),
    );
    expect(parsed).toEqual({
      settings: {
        shopName: 'ACME',
        primaryColor: '#b91c1c',
        surfaceColor: '#fde68a',
        debugWidget: true,
      },
      logo: { type: 'image/png', base64: 'aGVsbG8=' },
    });
  });

  it('accepts a payload without a logo', () => {
    expect(parseSharePayload(payload({ logo: null }))?.logo).toBeNull();
  });

  it('defaults debugWidget to false when missing or non-boolean', () => {
    expect(
      parseSharePayload(
        payload({ settings: { shopName: 'A', primaryColor: '#b91c1c', surfaceColor: '#fde68a' } }),
      )?.settings.debugWidget,
    ).toBe(false);
    expect(
      parseSharePayload(
        payload({
          settings: { shopName: 'A', primaryColor: '#b91c1c', surfaceColor: '#fde68a', debugWidget: 'yes' },
        }),
      )?.settings.debugWidget,
    ).toBe(false);
  });

  it('rejects invalid payloads outright', () => {
    expect(parseSharePayload(null)).toBeNull();
    expect(parseSharePayload('x')).toBeNull();
    expect(parseSharePayload({})).toBeNull();
    expect(
      parseSharePayload(payload({ settings: { shopName: '', primaryColor: '#b91c1c', surfaceColor: '#fde68a' } })),
    ).toBeNull();
    expect(
      parseSharePayload(payload({ settings: { shopName: 'A', primaryColor: 'red', surfaceColor: '#fde68a' } })),
    ).toBeNull();
    expect(parseSharePayload(payload({ logo: { type: 'application/pdf', base64: 'aGVsbG8=' } }))).toBeNull();
    expect(parseSharePayload(payload({ logo: { type: 'image/png' } }))).toBeNull();
  });
});

describe('share links', () => {
  it('builds the link with the wl query param', () => {
    expect(buildShareLink('http://localhost:3000', 'abc-123')).toBe('http://localhost:3000/?wl=abc-123');
    expect(SHARE_QUERY_PARAM).toBe('wl');
  });

  it('extracts the share id from a search string', () => {
    expect(shareIdFromSearch('?wl=abc-123&x=1')).toBe('abc-123');
    expect(shareIdFromSearch('?x=1')).toBeNull();
    expect(shareIdFromSearch('?wl=')).toBeNull();
    expect(shareIdFromSearch('')).toBeNull();
  });
});
