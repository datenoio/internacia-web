import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { geographyIndexMd } from '../lib/browse';

export const GET: APIRoute = () => markdown(geographyIndexMd());
