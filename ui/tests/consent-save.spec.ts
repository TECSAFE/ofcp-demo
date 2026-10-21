import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { CONSENT_STORAGE_KEY, type ConsentSettings } from '../app/utils/consent';

vi.mock('~/utils/consent', () => import('../app/utils/consent'));
import { useConsent } from '../app/composables/useConsent';

afterEach(() => vi.unstubAllGlobals());

function setup(loggedIn: boolean) {
  const previous: ConsentSettings = {
    version: 'v2',
    dataExchange: false,
    tracking: false,
    nativeTracking: false,
    updatedAt: 'old',
  };
  const consent = ref<ConsentSettings | null>(previous);
  const bannerOpen = ref(true);
  const states = {
    consent,
    'consent-banner-open': bannerOpen,
    'auth-user': ref(loggedIn ? { id: 'u' } : null),
  };
  const stored = new Map([[CONSENT_STORAGE_KEY, JSON.stringify(previous)]]);
  const api = vi.fn();
  vi.stubGlobal('useState', (key: keyof typeof states) => states[key]);
  vi.stubGlobal('useApi', () => api);
  vi.stubGlobal('localStorage', {
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  return { ...useConsent(), consent, bannerOpen, stored, api, previous };
}

const choice = { version: 'v2' as const, dataExchange: true, tracking: true, nativeTracking: true };

describe('saving consent', () => {
  it('keeps the previous choice active until the account save succeeds', async () => {
    const state = setup(true);
    let accept!: () => void;
    state.api.mockReturnValue(
      new Promise<void>((resolve) => {
        accept = resolve;
      }),
    );
    const saving = state.save(choice);
    expect(state.consent.value).toEqual(state.previous);
    expect(JSON.parse(state.stored.get(CONSENT_STORAGE_KEY)!)).toEqual(state.previous);
    expect(state.bannerOpen.value).toBe(true);
    accept();
    await saving;
    expect(state.consent.value).toMatchObject(choice);
    expect(JSON.parse(state.stored.get(CONSENT_STORAGE_KEY)!)).toEqual(state.consent.value);
    expect(state.api).toHaveBeenCalledWith('/consent', {
      method: 'PUT',
      body: state.consent.value,
    });
    expect(state.bannerOpen.value).toBe(false);
  });

  it('retains local consent and the open banner after a failed account save', async () => {
    const state = setup(true);
    state.api.mockRejectedValue(new Error('Unavailable'));
    await expect(state.save(choice)).rejects.toThrow('Unavailable');
    expect(state.consent.value).toEqual(state.previous);
    expect(JSON.parse(state.stored.get(CONSENT_STORAGE_KEY)!)).toEqual(state.previous);
    expect(state.bannerOpen.value).toBe(true);
  });

  it('saves guest choices locally without contacting the API', async () => {
    const state = setup(false);
    await state.save(choice);
    expect(state.consent.value).toMatchObject(choice);
    expect(JSON.parse(state.stored.get(CONSENT_STORAGE_KEY)!)).toEqual(state.consent.value);
    expect(state.bannerOpen.value).toBe(false);
    expect(state.api).not.toHaveBeenCalled();
  });
});
