import { describe, expect, it } from 'vitest';
import {
  consentForVersion,
  parseStoredConsent,
  reconcileConsentOnLogin,
  type ConsentSettings,
} from '../app/utils/consent';

const consent = (over: Partial<ConsentSettings> = {}): ConsentSettings => ({
  dataExchange: true,
  tracking: false,
  nativeTracking: false,
  version: 'v1',
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

  it('migrates combined tracking and preserves split tracking on reload', () => {
    expect(
      parseStoredConsent(JSON.stringify({ dataExchange: true, tracking: true })),
    ).toMatchObject({ version: 'v1', tracking: true, nativeTracking: true });
    expect(
      parseStoredConsent(
        JSON.stringify(consent({ version: 'v3', tracking: false, nativeTracking: true })),
      ),
    ).toEqual(consent({ version: 'v3', tracking: false, nativeTracking: true }));
    expect(parseStoredConsent('null')).toBeNull();
  });
});

describe('consentForVersion', () => {
  it('keeps v1 required privacy enabled without opting into either kind of tracking', () => {
    expect(
      consentForVersion('v1', {
        dataExchange: false,
        tracking: false,
        nativeTracking: false,
      }),
    ).toEqual({
      version: 'v1',
      dataExchange: true,
      tracking: false,
      nativeTracking: false,
    });
  });

  it.each(['v2', 'v3'] as const)('keeps data exchange and tracking opt-in in %s', (version) => {
    expect(
      consentForVersion(version, {
        dataExchange: false,
        tracking: false,
        nativeTracking: false,
      }),
    ).toEqual({ version, dataExchange: false, tracking: false, nativeTracking: false });
  });

  it.each(['v1', 'v2'] as const)('keeps combined usage choices in sync in %s', (version) => {
    expect(
      consentForVersion(version, {
        dataExchange: true,
        tracking: true,
        nativeTracking: false,
      }),
    ).toEqual({
      version,
      dataExchange: true,
      tracking: true,
      nativeTracking: true,
    });
  });

  it('keeps shop tracking independent of TECSAFE tracking in v3', () => {
    expect(
      consentForVersion('v3', {
        dataExchange: false,
        tracking: false,
        nativeTracking: true,
      }),
    ).toEqual({
      version: 'v3',
      dataExchange: false,
      tracking: false,
      nativeTracking: true,
    });
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
