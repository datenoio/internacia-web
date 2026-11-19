import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { aliases } from '../../../lib/data';

// Retired and renamed IDs exactly as internacia-db publishes them (SPEC §5.3).
export const GET: APIRoute = () =>
  json({ meta: apiMeta(), intblocks: aliases().intblocks, countries: aliases().countries });
