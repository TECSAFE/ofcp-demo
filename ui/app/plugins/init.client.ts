import { SHARE_QUERY_PARAM, shareIdFromSearch } from '~/utils/whitelabel-share';

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig();
  if (!config.public.apiBase || !config.public.widgetBaseUrl) {
    throw new Error(
      'Missing runtime config: set NUXT_PUBLIC_API_BASE and NUXT_PUBLIC_WIDGET_BASE_URL',
    );
  }
  const auth = useAuth();
  const { loadInitial } = useConsent();
  const whitelabel = useWhitelabel();

  // A ?wl=<id> link imports server-stored whitelabel settings into this
  // browser's stores; loadInitial() below then applies them like any other.
  const shareId = shareIdFromSearch(window.location.search);
  if (shareId) {
    await whitelabel.applyServerShare(shareId);
    const url = new URL(window.location.href);
    url.searchParams.delete(SHARE_QUERY_PARAM);
    history.replaceState(history.state, '', url);
  }

  await whitelabel.loadInitial();
  await auth.fetchMe().catch(() => {
    // API down: stay in guest mode, the shop still renders.
  });
  await loadInitial();
});
