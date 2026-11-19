// Shared pieces of the static JSON API and Markdown twins (SPEC §7.3, §7.4).
import { meta } from './meta';
import { absolute, path } from './urls';

export const LICENSE = 'CC-BY-4.0';

// centroid values come from mledoze/countries under ODbL-1.0 (internacia-db ATTRIBUTION.md).
export const CENTROID_NOTE =
  'The centroid field is extracted from mledoze/countries and remains under ODbL-1.0; every other field is CC-BY-4.0.';

export function apiMeta(opts: { html?: string; markdown?: string; notes?: string[] } = {}) {
  return {
    data_version: meta.data.version,
    contract_version: meta.data.contract_version,
    built_at: meta.data.build_date,
    license: LICENSE,
    source: meta.data.release_url,
    ...(opts.html ? { html: absolute(opts.html) } : {}),
    ...(opts.markdown ? { markdown: absolute(opts.markdown) } : {}),
    ...(opts.notes?.length ? { license_notes: opts.notes } : {}),
    api: absolute(path('api/v1/index.json')),
  };
}

export function json(body: unknown, pretty = true): Response {
  return new Response(JSON.stringify(body, null, pretty ? 2 : undefined) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function markdown(body: string): Response {
  return new Response(body.endsWith('\n') ? body : `${body}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export function text(body: string, type = 'text/plain'): Response {
  return new Response(body.endsWith('\n') ? body : `${body}\n`, {
    headers: { 'Content-Type': `${type}; charset=utf-8` },
  });
}
