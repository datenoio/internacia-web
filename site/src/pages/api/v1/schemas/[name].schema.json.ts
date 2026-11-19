import type { APIRoute } from 'astro';
import { json } from '../../../../lib/api';
import { SCHEMAS } from '../../../../lib/schemas';

export function getStaticPaths() {
  return Object.keys(SCHEMAS).map((name) => ({ params: { name } }));
}

export const GET: APIRoute = ({ params }) => json(SCHEMAS[params.name!]);
