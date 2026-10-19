export const CONSENT_VERSIONS = ['v1', 'v2', 'v3'] as const;
export type ConsentVersion = (typeof CONSENT_VERSIONS)[number];

export type ConsentSettings = {
  version: ConsentVersion;
  dataExchange: boolean;
  tracking: boolean;
  nativeTracking: boolean;
  updatedAt: string;
};

export function consentForVersion(
  version: ConsentVersion,
  choice: Pick<ConsentSettings, 'dataExchange' | 'tracking' | 'nativeTracking'>,
): Omit<ConsentSettings, 'updatedAt'> {
  return {
    ...choice,
    version,
    dataExchange: version === 'v1' || choice.dataExchange,
    nativeTracking: version === 'v3' ? choice.nativeTracking : choice.tracking,
  };
}

export const CONSENT_STORAGE_KEY = 'demo-shop-consent';

export function parseStoredConsent(raw: string | null): ConsentSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentSettings>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.dataExchange !== 'boolean' || typeof parsed.tracking !== 'boolean') {
      return null;
    }
    return {
      version: CONSENT_VERSIONS.includes(parsed.version as ConsentVersion) ? parsed.version! : 'v1',
      dataExchange: parsed.dataExchange,
      tracking: parsed.tracking,
      nativeTracking:
        typeof parsed.nativeTracking === 'boolean' ? parsed.nativeTracking : parsed.tracking,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Login rule: the account's stored consent wins (restore from server);
 * only when the account has none does the guest's local choice transfer up.
 */
export function reconcileConsentOnLogin(
  local: ConsentSettings | null,
  server: ConsentSettings | null,
): { effective: ConsentSettings | null; pushToServer: boolean } {
  if (server) return { effective: server, pushToServer: false };
  if (local) return { effective: local, pushToServer: true };
  return { effective: null, pushToServer: false };
}
