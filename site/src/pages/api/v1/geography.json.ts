import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { geography } from '../../../lib/data';
import { path } from '../../../lib/urls';

export const GET: APIRoute = () =>
  json({ meta: apiMeta({ html: path('geography/'), markdown: path('geography.md') }), count: geography().length, data: geography() }, false);
