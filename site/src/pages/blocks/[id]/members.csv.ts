// Roster of an intblock as CSV (SPEC §6.5, item 5): every includes[] entry, current and former,
// with the same fields as the roster table and the card's JSON (`_roster`). `role` (contract 4.1)
// is appended last so existing column positions do not move.
import type { APIRoute } from 'astro';
import { blockById, blocks } from '../../../lib/data';

export function getStaticPaths() {
  return blocks()
    .filter((b) => b._roster.length > 0)
    .map((b) => ({ params: { id: b.id.toLowerCase() }, props: { id: b.id } }));
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET: APIRoute = ({ props }) => {
  const b = blockById().get(props.id)!;
  const head = ['id', 'name', 'type', 'status', 'joined', 'left', 'current', 'note', 'role'];
  const rows = b._roster.map((r) =>
    [r.id, r.name, r.type, r.status, r.joined, r.left, r.current ? 'yes' : 'no', r.note, r.role].map(cell).join(','),
  );
  return new Response(`${[head.join(','), ...rows].join('\r\n')}\r\n`, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
