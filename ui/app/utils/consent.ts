export type ConsentSettings = {
  dataExchange: boolean;
  tracking: boolean;
  updatedAt: string;
};

export const CONSENT_STORAGE_KEY = 'demo-shop-consent';

export function parseStoredConsent(raw: string | null): ConsentSettings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentSettings>;
    if (typeof parsed.dataExchange !== 'boolean' || typeof parsed.tracking !== 'boolean') {
      return null;
    }
    return {
      dataExchange: parsed.dataExchange,
      tracking: parsed.tracking,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
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
