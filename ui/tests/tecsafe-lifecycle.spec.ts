import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, watch } from 'vue';
import { DEFAULT_WHITELABEL } from '../app/utils/whitelabel';

const scope = effectScope();
afterEach(() => {
  scope.stop();
  vi.unstubAllGlobals();
});

describe('SDK debugger lifecycle', () => {
  it('keeps the configurator alive for branding saves and rebuilds for either debug mode', async () => {
    const settings = ref({ ...DEFAULT_WHITELABEL });
    const consent = ref({ dataExchange: true, tracking: false });
    let destroyed = 0;
    vi.stubGlobal('defineNuxtPlugin', (setup: () => void) => setup);
    vi.stubGlobal('useConsent', () => ({ consent }));
    vi.stubGlobal('useAuth', () => ({ user: ref(null) }));
    vi.stubGlobal('useWhitelabel', () => ({ settings }));
    vi.stubGlobal('useTecsafe', () => ({
      destroy: async () => {
        destroyed++;
      },
      refreshToken: async () => {},
    }));
    vi.stubGlobal('watch', watch);
    const { default: setup } = await import('../app/plugins/tecsafe.client');
    scope.run(() => (setup as unknown as () => void)());
    settings.value = { ...settings.value, shopName: 'New branding' };
    await nextTick();
    expect(destroyed).toBe(0);
    settings.value = { ...settings.value, sdkDebugger: true };
    await nextTick();
    expect(destroyed).toBe(1);
    settings.value = { ...settings.value, debugWidget: true };
    await nextTick();
    expect(destroyed).toBe(2);
  });
});
