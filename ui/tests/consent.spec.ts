import { describe, expect, it } from 'vitest';
import { parseStoredConsent, reconcileConsentOnLogin, type ConsentSettings } from '../app/utils/consent';

const consent = (over: Partial<ConsentSettings> = {}): ConsentSettings => ({
  dataExchange: true,
  tracking: false,
  updatedAt: '2026-07-20T00:00:00.000Z',
  ...over,
});

describe('parseStoredConsent', () => {
  it('parses a valid stored value', () => {
    expect(parseStoredConsent(JSON.stringify(consent()))).toEqual(consent());
  });

  it('returns null for missing, invalid JSON, or wrong-shaped values', () => {
    expect(parseStoredConsent(null)).toBeNull();
    expect(parseStoredConsent('{oops')).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ dataExchange: 'yes' }))).toBeNull();
  });

  it('fills a missing updatedAt with the epoch', () => {
    const parsed = parseStoredConsent(JSON.stringify({ dataExchange: true, tracking: true }));
    expect(parsed?.updatedAt).toBe(new Date(0).toISOString());
  });
});

describe('reconcileConsentOnLogin', () => {
  it('prefers the server value when the server has one (restore on login)', () => {
    const server = consent({ tracking: true });
    expect(reconcileConsentOnLogin(consent(), server)).toEqual({
      effective: server,
      pushToServer: false,
    });
  });

  it('pushes the local guest value up when the server has none', () => {
    const local = consent();
    expect(reconcileConsentOnLogin(local, null)).toEqual({
      effective: local,
      pushToServer: true,
    });
  });

  it('yields nothing when neither side has consent', () => {
    expect(reconcileConsentOnLogin(null, null)).toEqual({
      effective: null,
      pushToServer: false,
    });
  });
});
