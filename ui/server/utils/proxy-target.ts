/** Upstream URL for an /api/** request. Pure so the URL logic is testable. */
export function buildProxyTarget(targetBase: string, path: string, search: string): string {
  return `${targetBase.replace(/\/+$/, '')}/${path}${search}`;
}
