import type { APIRoute } from 'astro';
import { text } from '../lib/api';
import { absolute, path } from '../lib/urls';

// Allow all crawlers, AI crawlers included (SPEC §7.6, open question Q4: default allow).
export const GET: APIRoute = () =>
  text(`User-agent: *\nAllow: /\n\nSitemap: ${absolute(path('sitemap.xml'))}\n# AI agents: ${absolute(path('llms.txt'))}\n`);
