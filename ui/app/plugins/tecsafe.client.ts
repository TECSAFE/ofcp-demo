export default defineNuxtPlugin(() => {
  const { consent } = useConsent();
  const { user } = useAuth();
  const tecsafe = useTecsafe();

  // Consent withdrawn -> tear the SDK down (GDPR requirement from the SDK
  // docs). Tracking flag changed -> recreate, since trackingAllowed is a
  // constructor-time setting; the PDP's own consent watcher remounts.
  watch(consent, async (next, prev) => {
    if (!next?.dataExchange) {
      await tecsafe.destroy();
      return;
    }
    if (prev?.dataExchange && prev.tracking !== next.tracking) {
      await tecsafe.destroy();
    }
  });

  // Login/logout: the SDK must exchange the token so TECSAFE merges guest
  // assets into the account (login) or starts a clean guest session (logout).
  watch(user, async () => {
    await tecsafe.refreshToken();
  });
});
