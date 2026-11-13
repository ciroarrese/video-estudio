/** URL for a file under /public. asset('img/a.png') -> '<base>img/a.png' */
export function asset(path: string): string {
  const clean = path.replace(/^\/+/, '');
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return base.endsWith('/') ? base + clean : `${base}/${clean}`;
}
