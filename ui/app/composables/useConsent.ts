import {
  CONSENT_STORAGE_KEY,
  parseStoredConsent,
  reconcileConsentOnLogin,
  type ConsentSettings,
} from '~/utils/consent';

export function useConsent() {
  const consent = useState<ConsentSettings | null>('consent', () => null);
  const bannerOpen = useState<boolean>('consent-banner-open', () => false);
  const user = useState<AuthUser | null>('auth-user', () => null);
  const api = useApi();

  function persistLocal(value: ConsentSettings | null): void {
    if (value) localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(CONSENT_STORAGE_KEY);
  }

  function loadFromBrowser(): void {
    consent.value = parseStoredConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
    if (!consent.value) bannerOpen.value = true;
  }

  async function reconcileWithServer(): Promise<void> {
    const { consent: server } = await api<{ consent: ConsentSettings | null }>('/consent');
    const { effective, pushToServer } = reconcileConsentOnLogin(consent.value, server);
    consent.value = effective;
    persistLocal(effective);
    if (pushToServer && effective) {
      await api('/consent', { method: 'PUT', body: effective });
    }
    if (!effective) bannerOpen.value = true;
  }

  async function loadInitial(): Promise<void> {
    loadFromBrowser();
    if (user.value) await reconcileWithServer();
  }

  async function save(choice: { dataExchange: boolean; tracking: boolean }): Promise<void> {
    const next: ConsentSettings = { ...choice, updatedAt: new Date().toISOString() };
    consent.value = next;
    persistLocal(next);
    if (user.value) await api('/consent', { method: 'PUT', body: next });
    bannerOpen.value = false;
  }

  function openBanner(): void {
    bannerOpen.value = true;
  }

  return { consent, bannerOpen, loadInitial, reconcileWithServer, save, openBanner };
}
