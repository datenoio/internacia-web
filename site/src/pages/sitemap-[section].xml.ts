import type { APIRoute } from 'astro';
import { text } from '../lib/api';
import { blocks, countries } from '../lib/data';
import { meta } from '../lib/meta';
import { absolute, blockPath, countryPath, path } from '../lib/urls';

// lastmod is the data release build date: internacia-db does not publish per-record change dates.
export function getStaticPaths() {
  return [{ params: { section: 'pages' } }, { params: { section: 'countries' } }, { params: { section: 'blocks' } }];
}

const urls = (section: string): string[] => {
  if (section === 'countries') return countries().map((c) => countryPath(c.code));
  if (section === 'blocks') return blocks().map((b) => blockPath(b.id));
  return [path(''), path('countries/'), path('blocks/'), path('data/'), path('about/')];
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
