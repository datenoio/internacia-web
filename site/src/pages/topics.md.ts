import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { topicsIndexMd } from '../lib/browse';

export const GET: APIRoute = () => markdown(topicsIndexMd());
