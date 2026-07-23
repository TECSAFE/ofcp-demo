export function useAuth() {
  const user = useState<AuthUser | null>('auth-user', () => null);
  const api = useApi();

  async function fetchMe(): Promise<void> {
    const res = await api<{ user: AuthUser | null }>('/auth/me');
    user.value = res.user;
  }

  async function register(email: string, password: string): Promise<void> {
    // The guest's browser-stored consent travels along and becomes
    // the new account's server-side consent.
    const consent = useConsent().consent.value;
    const res = await api<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: { email, password, consent: consent ?? undefined },
    });
    user.value = res.user;
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await api<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    user.value = res.user;
    // Restore the account's consent from the server (server value wins).
    await useConsent().reconcileWithServer();
  }

  async function logout(): Promise<void> {
    await api('/auth/logout', { method: 'POST' });
    user.value = null;
  }

  return { user, fetchMe, register, login, logout };
}
