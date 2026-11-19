import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { blocks } from '../../../lib/data';

// All current membership edges of countries and territories (SPEC §7.4), as compact rows:
//   [block_id, country_code, status, joined]
export const GET: APIRoute = () => {
  const rows: [string, string, string, string | null][] = [];
  for (const b of blocks()) {
    for (const r of b._roster) {
      if (r.current && (r.type === 'country' || r.type === 'territory')) rows.push([b.id, r.id, r.status, r.joined]);
    }
  }
  return json({ meta: apiMeta(), format: ['block_id', 'country_code', 'status', 'joined'], count: rows.length, data: rows }, false);
};
