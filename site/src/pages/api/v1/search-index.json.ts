import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { agreementEnded } from '../../../lib/agreements';
import { agreements, blocks, countries } from '../../../lib/data';
import { agreementPath, blockPath, countryPath } from '../../../lib/urls';

// Entity finder index (SPEC §6.12): every name, acronym and code of every country and intblock,
// in all languages. Compact rows keep it within the 300 KB gzip budget:
//   [kind, id, label, path, active, names]   names: [[text, lang], ...]
// kind is "c" (country), "b" (intblock) or "a" (trade agreement, contract 5.0); lang is "" for
// codes and IDs. An agreement is active unless it is terminated, superseded or abandoned.
// Investment treaties (contract 5.1: 3,503 records in v5.1.0, two thirds of the registry) are left
// out: with them the index is about 360 KB gzip. Full-text search (/search/) and the country cards
// still find them.
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
  for (const a of agreements()) {
    if (a.agreement_type === 'investment') continue;
    const names: Name[] = [
      [a._name, 'en'],
      [a.id, ''],
      ...(a.acronyms ?? []).map((x): Name => [x.value, x.lang]),
      ...(a.other_names ?? []).map((n): Name => [n.name, n.lang]),
    ];
    const label = a._acronym ? `${a._name} (${a._acronym})` : a._name;
    rows.push(['a', a.id, label, agreementPath(a.id), agreementEnded(a.status) ? 0 : 1, uniq(names)]);
  }
  return json({ meta: apiMeta(), format: ['kind', 'id', 'label', 'path', 'active', 'names'], data: rows }, false);
};
