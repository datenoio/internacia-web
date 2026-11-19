import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { headquarters } from '../../../lib/explore';

// Intblocks with headquarters coordinates (SPEC §8, V5).
export const GET: APIRoute = () => json({ meta: apiMeta(), count: headquarters().length, data: headquarters() }, false);
