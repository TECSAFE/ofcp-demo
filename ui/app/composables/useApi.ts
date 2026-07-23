export function useApi() {
  const config = useRuntimeConfig();
  return $fetch.create({
    baseURL: config.public.apiBase,
    // The demo API identifies the browser session via its `sid` cookie.
    credentials: 'include',
  });
}
