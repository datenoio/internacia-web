import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { meta } from '../../../lib/meta';
import { absolute, path } from '../../../lib/urls';

export const GET: APIRoute = () =>
  json({
    meta: apiMeta({ html: path(''), markdown: path('index.md') }),
    counts: meta.counts,
    endpoints: {
      countries: absolute(path('api/v1/countries.json')),
      country: absolute(path('api/v1/countries/{CODE}.json')),
      blocks: absolute(path('api/v1/blocks.json')),
      block: absolute(path('api/v1/blocks/{ID}.json')),
      aliases: absolute(path('api/v1/aliases.json')),
      types: absolute(path('api/v1/types.json')),
      type: absolute(path('api/v1/types/{KEY}.json')),
      topics: absolute(path('api/v1/topics.json')),
      topic: absolute(path('api/v1/topics/{KEY}.json')),
      geography: absolute(path('api/v1/geography.json')),
      area: absolute(path('api/v1/geography/{SLUG}.json')),
      stats: absolute(path('api/v1/stats.json')),
      memberships: absolute(path('api/v1/memberships.json')),
      headquarters: absolute(path('api/v1/headquarters.json')),
      search_index: absolute(path('api/v1/search-index.json')),
      openapi: absolute(path('api/v1/openapi.json')),
    },
    notes: [
      '{CODE} is the ISO 3166-1 alpha-2 code as in the data (uppercase); {ID} is the exact intblock ID (case-sensitive).',
      'Derived fields start with an underscore; every other field is an internacia-db export field.',
      'Current members follow the current_memberships view of internacia-db: not former_member, no left date, intblock not historical or dissolved.',
    ],
    llms_txt: absolute(path('llms.txt')),
  });
