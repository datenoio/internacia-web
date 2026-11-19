import type { APIRoute } from 'astro';
import { text } from '../lib/api';
import { blocks, countries, geography, topics, types } from '../lib/data';
import { meta } from '../lib/meta';
import { absolute, areaPath, blockPath, countryPath, path, topicPath, typePath } from '../lib/urls';

// lastmod is the data release build date: internacia-db does not publish per-record change dates.
export function getStaticPaths() {
  return ['pages', 'countries', 'blocks', 'types', 'topics', 'geography'].map((section) => ({ params: { section } }));
}

const urls = (section: string): string[] => {
  if (section === 'countries') return countries().map((c) => countryPath(c.code));
  if (section === 'blocks') return blocks().map((b) => blockPath(b.id));
  if (section === 'types') return types().map((t) => typePath(t.id));
  if (section === 'topics') return topics().map((t) => topicPath(t.key));
  if (section === 'geography') return geography().map((a) => areaPath(a.slug));
  return ['', 'countries/', 'blocks/', 'types/', 'topics/', 'geography/', 'stats/', 'explore/', 'explore/map/', 'explore/timeline/', 'explore/founded/', 'explore/headquarters/', 'explore/compare/', 'explore/countries/', 'explore/hierarchy/', 'data/', 'embed/', 'about/'].map((p) => path(p));
};

export const GET: APIRoute = ({ params }) => {
  const lastmod = meta.data.build_date.slice(0, 10);
  return text(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls(params.section!).map((u) => `  <url><loc>${absolute(u)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>`,
    'application/xml',
  );
};
