// Shared helpers for explorers: URL state, escaping, data loading.

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const params = () => new URLSearchParams(location.search);

// Shareable state: the URL query string always describes what is shown (SPEC §6.9).
export function setParams(values: Record<string, string | string[] | null | undefined>) {
  const p = params();
  for (const [k, v] of Object.entries(values)) {
    const value = Array.isArray(v) ? v.join(',') : v;
    if (value) p.set(k, value);
    else p.delete(k);
  }
  const qs = p.toString();
  history.replaceState(null, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}

const cache = new Map<string, Promise<unknown>>();
export function getJson<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${url}`)))));
  return cache.get(url) as Promise<T>;
}

export const announce = (el: HTMLElement | null, text: string) => {
  if (el) el.textContent = text;
};
