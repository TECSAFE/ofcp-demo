import { buildProxyTarget } from '../../utils/proxy-target';

// Runtime /api proxy: same behavior under `nuxt dev` and the production
// node server, so the Docker container needs no extra reverse proxy.
export default defineEventHandler((event) => {
  const target = process.env.API_PROXY_TARGET || 'http://localhost:4000';
  const path = event.context.params?.path ?? '';
  return proxyRequest(event, buildProxyTarget(target, path, getRequestURL(event).search));
});
