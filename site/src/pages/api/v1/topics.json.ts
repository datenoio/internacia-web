import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { topics } from '../../../lib/data';
import { path } from '../../../lib/urls';

export const GET: APIRoute = () =>
  json({ meta: apiMeta({ html: path('topics/'), markdown: path('topics.md') }), count: topics().length, data: topics() }, false);
