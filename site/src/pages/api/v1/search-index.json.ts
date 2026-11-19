import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { blocks, countries } from '../../../lib/data';
import { blockPath, countryPath } from '../../../lib/urls';

// Entity finder index (SPEC §6.12): every name, acronym and code of every country and intblock,
// in all languages. Compact rows keep it within the 300 KB gzip budget:
//   [kind, id, label, path, active, names]   names: [[text, lang], ...]
// kind is "c" (country) or "b" (intblock); lang is "" for codes and IDs.
type Name = [string, string];

const uniq = (names: Name[]): Name[] => {
  const seen = new Set<string>();
  return names.filter(([text]) => {
    const key = text.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const GET: APIRoute = () => {
  const rows: unknown[] = [];
  for (const c of countries()) {
    const names: Name[] = [
      [c.name, 'en'],
      [c.code, ''],
      [c.iso3code, ''],
      ...(c.official_name ? [[c.official_name, 'en'] as Name] : []),
      ...(c.common_names ?? []).map((n): Name => [n, 'en']),
      ...(c.other_names ?? []).map((n): Name => [n.name, n.id]),
      ...Object.entries(c.native_names ?? {}).flatMap(([lang, n]) =>
        [n.official, n.common].filter((v): v is string => Boolean(v)).map((v): Name => [v, lang]),
      ),
    ];
    rows.push(['c', c.code, c.name, countryPath(c.code), 1, uniq(names)]);
  }
  for (const b of blocks()) {
    const names: Name[] = [
      [b.name, 'en'],
      [b.id, ''],
      ...(b.acronyms ?? []).map((a): Name => [a.value, a.lang]),
      ...(b.other_names ?? []).map((n): Name => [n.name, n.id]),
      ...(b.previous_names ?? []).map((n): Name => [n.name, n.id ?? '']),
    ];
    const label = b._acronym ? `${b.name} (${b._acronym})` : b.name;
    rows.push(['b', b.id, label, blockPath(b.id), b._active ? 1 : 0, uniq(names)]);
  }
  return json({ meta: apiMeta(), format: ['kind', 'id', 'label', 'path', 'active', 'names'], data: rows }, false);
};
