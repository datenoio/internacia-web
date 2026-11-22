import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { countries, type Indicator } from '../../../lib/data';
import { absolute, countryJson, countryPath, path } from '../../../lib/urls';

// Lite list (SPEC §7.4): enough to pick a country and build its URLs, and the population and land
// area structs the compare explorer adds up (V6).
const indicator = (v: Indicator | null | undefined) =>
  v && v.value !== null && v.value !== undefined ? { value: v.value, year: v.year ?? null, source: v.source || null, source_id: v.source_id || null } : null;

export const GET: APIRoute = () =>
  json(
    {
      meta: apiMeta({ html: path('countries/'), markdown: path('countries.md') }),
      count: countries().length,
      data: countries().map((c) => ({
        code: c.code,
        iso3code: c.iso3code,
        name: c.name,
        flag_emoji: c.flag_emoji ?? null,
        continents: c.continents ?? [],
        subregion: c.subregion ?? null,
        entity_type: c.entity_type,
        code_status: c.code_status,
        un_status: c.un_status ?? null,
        population: indicator(c.population),
        area: indicator(c.area),
        _current_member_count: c._current_member_count,
        _html: absolute(countryPath(c.code)),
        _json: absolute(countryJson(c.code)),
      })),
    },
    false,
  );
