import { deleteStoredLogo, getStoredLogo, putStoredLogo } from '~/utils/logo-store';
import {
  DEFAULT_WHITELABEL,
  WHITELABEL_STORAGE_KEY,
  parseStoredWhitelabel,
  type WhitelabelSettings,
} from '~/utils/whitelabel';
import {
  blobToShareLogo,
  buildShareLink,
  parseSharePayload,
  shareLogoToBlob,
} from '~/utils/whitelabel-share';

export function useWhitelabel() {
  const api = useApi();
  const settings = useState<WhitelabelSettings>('whitelabel', () => DEFAULT_WHITELABEL);
  const logoUrl = useState<string | null>('whitelabel-logo-url', () => null);
  const panelOpen = useState<boolean>('whitelabel-panel-open', () => false);

  function applyToDocument(value: WhitelabelSettings): void {
    const root = document.documentElement;
    root.style.setProperty('--wl-primary', value.primaryColor);
    root.style.setProperty('--wl-surface', value.surfaceColor);
  }

  function setLogoUrl(blob: Blob | null): void {
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value);
    logoUrl.value = blob ? URL.createObjectURL(blob) : null;
  }

  async function loadInitial(): Promise<void> {
    settings.value = parseStoredWhitelabel(localStorage.getItem(WHITELABEL_STORAGE_KEY)) ?? DEFAULT_WHITELABEL;
    applyToDocument(settings.value);
    setLogoUrl(await getStoredLogo().catch(() => null));
  }

  async function save(next: Omit<WhitelabelSettings, 'updatedAt'>, logoBlob: Blob | null): Promise<void> {
    const value: WhitelabelSettings = { ...next, updatedAt: new Date().toISOString() };
    localStorage.setItem(WHITELABEL_STORAGE_KEY, JSON.stringify(value));
    if (logoBlob) await putStoredLogo(logoBlob);
    else await deleteStoredLogo();
    settings.value = value;
    applyToDocument(value);
    setLogoUrl(logoBlob);
    panelOpen.value = false;
  }

  async function reset(): Promise<void> {
    localStorage.removeItem(WHITELABEL_STORAGE_KEY);
    await deleteStoredLogo().catch(() => {
      // Best effort: a broken IndexedDB must not block restoring the defaults.
    });
    settings.value = DEFAULT_WHITELABEL;
    applyToDocument(DEFAULT_WHITELABEL);
    setLogoUrl(null);
    panelOpen.value = false;
  }

  function openPanel(): void {
    panelOpen.value = true;
  }

  async function shareOnServer(
    next: Omit<WhitelabelSettings, 'updatedAt'>,
    logoBlob: Blob | null,
    secret: string,
    durationDays: number,
  ): Promise<{ link: string; expiresAt: string }> {
    const res = await api<{ id: string; expiresAt: string }>('/whitelabel-shares', {
      method: 'POST',
      body: {
        secret,
        durationDays,
        settings: next,
        ...(logoBlob ? { logo: await blobToShareLogo(logoBlob) } : {}),
      },
    });
    return { link: buildShareLink(window.location.origin, res.id), expiresAt: res.expiresAt };
  }

  async function applyServerShare(id: string): Promise<boolean> {
    try {
      const payload = parseSharePayload(
        await api(`/whitelabel-shares/${encodeURIComponent(id)}`),
      );
      if (!payload) return false;
      const value: WhitelabelSettings = {
        ...payload.settings,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(WHITELABEL_STORAGE_KEY, JSON.stringify(value));
      if (payload.logo) await putStoredLogo(shareLogoToBlob(payload.logo));
      else await deleteStoredLogo();
      return true;
    } catch {
      // Unknown/expired share or API down: keep whatever this browser had.
      return false;
    }
  }

  return { settings, logoUrl, panelOpen, loadInitial, save, reset, openPanel, shareOnServer, applyServerShare };
}
