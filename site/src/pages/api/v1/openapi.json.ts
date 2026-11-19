import type { APIRoute } from 'astro';
import { json } from '../../../lib/api';
import { openapi } from '../../../lib/schemas';

export const GET: APIRoute = () => json(openapi());
