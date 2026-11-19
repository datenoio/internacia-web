import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { frontMatter } from '../lib/markdown';
import { meta } from '../lib/meta';
import { absolute, path } from '../lib/urls';

export const GET: APIRoute = () => {
  const c = meta.counts;
  return markdown(
    [
      frontMatter({ type: 'home', url: absolute(path('')), data_version: meta.data.version, license: 'CC-BY-4.0' }),
      '# Internacia\n',
      'Countries, international organizations and country groupings from internacia-db, as cards for people and AI agents.\n',
      `- Countries and territories: ${c.countries} (${c.iso_countries} ISO 3166-1) — ${absolute(path('countries.md'))}`,
      `- Organizations and groupings: ${c.intblocks} — ${absolute(path('blocks.md'))}`,
      `- Block types: ${c.blocktypes}; topics: ${c.topics}`,
      `- Membership records: ${c.memberships} (${c.current_memberships} current)`,
      `- JSON API: ${absolute(path('api/v1/index.json'))}`,
      `- Guide for AI agents: ${absolute(path('llms.txt'))}`,
      `\nData: internacia-db v${meta.data.version} (${meta.data.release_url}).`,
    ].join('\n'),
  );
};
