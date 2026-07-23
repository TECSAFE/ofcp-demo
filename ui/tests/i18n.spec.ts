import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v as Json, key)
      : [key];
  });
}

function load(name: string): Json {
  return JSON.parse(readFileSync(new URL(`../i18n/locales/${name}.json`, import.meta.url), 'utf8'));
}

describe('locale catalogs', () => {
  it('de and en expose the identical set of keys', () => {
    const de = flatten(load('de')).sort();
    const en = flatten(load('en')).sort();
    expect(en).toEqual(de);
  });

  it('de and en use the same interpolation placeholders per key', () => {
    const de = load('de');
    const en = load('en');
    const placeholders = (obj: Json, key: string): string[] => {
      const value = key.split('.').reduce<unknown>((acc, k) => (acc as Json)?.[k], obj);
      const matches = typeof value === 'string' ? value.match(/\{(\w+)\}/g) ?? [] : [];
      return matches.sort();
    };
    for (const key of flatten(de)) {
      expect(placeholders(en, key), `placeholders for "${key}"`).toEqual(placeholders(de, key));
    }
  });
});
