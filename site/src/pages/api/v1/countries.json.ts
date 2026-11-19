import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { countries } from '../../../lib/data';
import { absolute, countryJson, countryPath, path } from '../../../lib/urls';

// Lite list (SPEC §7.4): enough to pick a country and build its URLs.
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
        _current_member_count: c._current_member_count,
        _html: absolute(countryPath(c.code)),
        _json: absolute(countryJson(c.code)),
      })),
    },
    false,
  );
