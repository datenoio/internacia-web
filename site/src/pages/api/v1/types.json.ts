import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { types } from '../../../lib/data';
import { path } from '../../../lib/urls';

export const GET: APIRoute = () =>
  json({ meta: apiMeta({ html: path('types/'), markdown: path('types.md') }), count: types().length, data: types() }, false);
