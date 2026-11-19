import type { APIRoute } from 'astro';
import { text } from '../lib/api';
import { meta } from '../lib/meta';
import { absolute, path } from '../lib/urls';

export const SECTIONS = ['pages', 'countries', 'blocks'] as const;

export const GET: APIRoute = () =>
  text(
    `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SECTIONS.map((s) => `  <sitemap><loc>${absolute(path(`sitemap-${s}.xml`))}</loc><lastmod>${meta.data.build_date.slice(0, 10)}</lastmod></sitemap>`).join('\n')}
</sitemapindex>`,
    'application/xml',
  );
