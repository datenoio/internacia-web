import type { APIRoute } from 'astro';
import { worldMap } from '../../lib/worldmap';

export const GET: APIRoute = () =>
  new Response(worldMap().svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } });
