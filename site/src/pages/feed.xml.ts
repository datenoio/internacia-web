import type { APIRoute } from 'astro';
import { text } from '../lib/api';
import { releases } from '../lib/data';
import { meta } from '../lib/meta';
import { absolute, path } from '../lib/urls';

// Atom feed of internacia-db data releases (SPEC §7.6). The release the site is built from carries
// its record counts.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = () => {
  const list = releases();
  const updated = meta.data.build_date;
  const c = meta.counts;
  const entries = list
    .map((r) => {
      const current = r.tag === meta.data.tag;
      const summary = current
        ? `Published on this site. ${c.countries} country records (${c.iso_countries} ISO 3166-1), ${c.intblocks} intblocks, ${c.memberships} membership records (${c.current_memberships} current).`
        : r.body.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 400) ?? r.name;
      return `  <entry>
    <id>${esc(r.url ?? `${meta.data.release_url.replace(meta.data.tag, r.tag)}`)}</id>
    <title>${esc(`internacia-db ${r.name}`)}</title>
    <updated>${esc(r.published_at ?? updated)}</updated>
    <link href="${esc(r.url ?? '')}"/>
    <summary>${esc(summary)}</summary>
  </entry>`;
    })
    .join('\n');
  return text(
    `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${absolute(path('feed.xml'))}</id>
  <title>Internacia: internacia-db data releases</title>
  <updated>${esc(updated)}</updated>
  <link rel="self" href="${absolute(path('feed.xml'))}"/>
  <link href="${absolute(path(''))}"/>
  <author><name>Dateno</name></author>
${entries}
</feed>`,
    'application/atom+xml',
  );
};
