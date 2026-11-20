import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { stats } from '../lib/data';
import { frontMatter, table } from '../lib/markdown';
import { meta } from '../lib/meta';
import { absolute, path } from '../lib/urls';

export const GET: APIRoute = () => {
  const s = stats();
  const cov = (rows: typeof s.countries.completeness) =>
    table(
      ['Field', 'Filled', 'Records', 'Gate (max missing)', 'Met', 'Missing'],
      rows.map((r) => [r.field, `${(r.share * 100).toFixed(1)}%`, `${r.filled}/${r.total}`, r.gate ? `${(r.gate.max_null_rate * 100).toFixed(0)}% (${r.gate.mode})` : 'optional', r.gate ? (r.gate.met ? 'yes' : 'no') : '', r.missing.length]),
    );
  const counts = (o: Record<string, number>) => table(['Value', 'Records'], Object.entries(o));
  return markdown(
    [
      frontMatter({ type: 'stats', url: absolute(path('stats/')), json: absolute(path('api/v1/stats.json')), data_version: meta.data.version }),
      `# Statistics and coverage (internacia-db v${meta.data.version})\n`,
      `Lists of the records missing each field are in ${absolute(path('api/v1/stats.json'))}.\n`,
      `## Field coverage: countries\n\n${cov(s.countries.completeness)}\n`,
      `## Field coverage: intblocks\n\n${cov(s.intblocks.completeness)}\n`,
      `## Intblocks by status\n\n${counts(s.intblocks.by_status)}\n`,
      `## Intblocks by scope category\n\n${counts(s.intblocks.by_scope_category)}\n`,
      `## Intblocks founded by decade\n\n${counts(s.intblocks.founded_decades)}\n`,
      `## Intblocks by month of last verification\n\n${counts(s.intblocks.last_verified_months)}\n`,
      `## Membership records by status\n\n${counts(s.memberships.by_status)}\n`,
      `## Membership records by route role (pipelines and corridors)\n\n${counts(s.memberships.by_role ?? {})}\n`,
      `## Country records by entity type\n\n${counts(s.countries.by_entity_type)}\n`,
    ].join('\n'),
  );
};
