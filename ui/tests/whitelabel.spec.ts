import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WHITELABEL,
  MAX_LOGO_BYTES,
  isHexColor,
  parseStoredWhitelabel,
  validateLogoFile,
  type WhitelabelSettings,
} from '../app/utils/whitelabel';

const settings = (over: Partial<WhitelabelSettings> = {}): WhitelabelSettings => ({
  shopName: 'ACME Tools',
  primaryColor: '#ff0000',
  surfaceColor: '#00ff00',
  debugWidget: false,
  updatedAt: '2026-07-21T00:00:00.000Z',
  ...over,
});

describe('isHexColor', () => {
  it('accepts 6-digit hex colors', () => {
    expect(isHexColor('#0f172a')).toBe(true);
    expect(isHexColor('#ABCDEF')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#12345g')).toBe(false);
    expect(isHexColor(42)).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});

describe('validateLogoFile', () => {
  it('accepts an image within the size cap', () => {
    expect(validateLogoFile({ type: 'image/png', size: MAX_LOGO_BYTES })).toBeNull();
    expect(validateLogoFile({ type: 'image/svg+xml', size: 1024 })).toBeNull();
  });

  it('returns "notImage" for non-image files', () => {
    expect(validateLogoFile({ type: 'application/pdf', size: 1024 })).toBe('notImage');
    expect(validateLogoFile({ type: '', size: 1024 })).toBe('notImage');
  });

  it('returns "tooLarge" for files over the 2 MB cap', () => {
    expect(validateLogoFile({ type: 'image/png', size: MAX_LOGO_BYTES + 1 })).toBe('tooLarge');
  });
});

describe('parseStoredWhitelabel', () => {
  it('parses a fully valid stored value', () => {
    expect(parseStoredWhitelabel(JSON.stringify(settings()))).toEqual(settings());
  });

  it('returns null for missing, invalid JSON, or non-object values', () => {
    expect(parseStoredWhitelabel(null)).toBeNull();
    expect(parseStoredWhitelabel('{oops')).toBeNull();
    expect(parseStoredWhitelabel('"just a string"')).toBeNull();
    expect(parseStoredWhitelabel('null')).toBeNull();
  });

  it('falls back to defaults for invalid individual fields', () => {
    const parsed = parseStoredWhitelabel(
      JSON.stringify({ shopName: '  ', primaryColor: 'red', surfaceColor: 123 }),
    );
    expect(parsed).toEqual({
      shopName: DEFAULT_WHITELABEL.shopName,
      primaryColor: DEFAULT_WHITELABEL.primaryColor,
      surfaceColor: DEFAULT_WHITELABEL.surfaceColor,
      debugWidget: DEFAULT_WHITELABEL.debugWidget,
      updatedAt: new Date(0).toISOString(),
    });
  });

  it('trims the shop name', () => {
    const parsed = parseStoredWhitelabel(JSON.stringify({ shopName: ' ACME ' }));
    expect(parsed?.shopName).toBe('ACME');
  });

  it('parses debugWidget when present', () => {
    expect(parseStoredWhitelabel(JSON.stringify(settings({ debugWidget: true })))?.debugWidget).toBe(true);
    expect(parseStoredWhitelabel(JSON.stringify(settings({ debugWidget: false })))?.debugWidget).toBe(false);
  });

  it('defaults debugWidget to false for missing or non-boolean values', () => {
    const { debugWidget: _drop, ...withoutFlag } = settings();
    expect(parseStoredWhitelabel(JSON.stringify(withoutFlag))?.debugWidget).toBe(false);
    expect(
      parseStoredWhitelabel(JSON.stringify({ ...settings(), debugWidget: 'yes' }))?.debugWidget,
    ).toBe(false);
  });
});

describe('DEFAULT_WHITELABEL', () => {
  it('matches the shipped slate look', () => {
    expect(DEFAULT_WHITELABEL.shopName).toBe('Demo Shop');
    expect(DEFAULT_WHITELABEL.primaryColor).toBe('#0f172a');
    expect(DEFAULT_WHITELABEL.surfaceColor).toBe('#cbd5e1');
  });

  it('ships with debugWidget off', () => {
    expect(DEFAULT_WHITELABEL.debugWidget).toBe(false);
  });
});
