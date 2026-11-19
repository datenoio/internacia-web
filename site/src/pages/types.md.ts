import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { typesIndexMd } from '../lib/browse';

export const GET: APIRoute = () => markdown(typesIndexMd());
