import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { blocks } from '../../../lib/data';

// All current membership edges of countries and territories (SPEC §7.4), as compact rows:
//   [block_id, country_code, status, joined, role]
// `role` (contract 4.1, pipelines and corridors; null elsewhere) is appended last, as internacia-db
// appends it to the memberships table.
export const GET: APIRoute = () => {
  const rows: [string, string, string, string | null, string | null][] = [];
  for (const b of blocks()) {
    for (const r of b._roster) {
      if (r.current && (r.type === 'country' || r.type === 'territory')) rows.push([b.id, r.id, r.status, r.joined, r.role]);
    }
  }
  return json({ meta: apiMeta(), format: ['block_id', 'country_code', 'status', 'joined', 'role'], count: rows.length, data: rows }, false);
};
