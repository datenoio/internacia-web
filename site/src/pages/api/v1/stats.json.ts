import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { stats } from '../../../lib/data';
import { meta } from '../../../lib/meta';
import { path } from '../../../lib/urls';

export const GET: APIRoute = () =>
  json({ meta: apiMeta({ html: path('stats/'), markdown: path('stats.md') }), counts: meta.counts, data: stats() }, false);
