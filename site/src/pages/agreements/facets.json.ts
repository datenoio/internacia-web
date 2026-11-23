import type { APIRoute } from 'astro';
import { json } from '../../lib/api';
import { AGREEMENT_FACETS, agreementFacetValues } from '../../lib/agreements';
import { agreements } from '../../lib/data';
import { meta } from '../../lib/meta';
import { agreementPath } from '../../lib/urls';

// Filter values of the trade agreements index (/agreements/), loaded by scripts/tables.ts
// (data-rows) when the reader first reaches for the search or the filters. Not part of the API:
// it holds no fact the table, the cards and their twins do not show, only the keys the filters
// match. One row per agreement, keyed by the path of the row's link:
//   [path, search, countries, status, type, parties, verification]
// search is the ID when the row does not show it (the acronym differs), else empty; several
// values are joined with "|", as in a data attribute. check_site.py compares countries with the
// country_trade_agreements view and the paths with the index.
export const GET: APIRoute = () =>
  json(
    {
      data_version: meta.data.version,
      format: ['path', 'search', ...AGREEMENT_FACETS],
      data: agreements().map((a) => {
        const values = agreementFacetValues(a);
        return [agreementPath(a.id), a.id !== a._acronym ? a.id : '', ...AGREEMENT_FACETS.map((k) => values[k].join('|'))];
      }),
    },
    false,
  );
