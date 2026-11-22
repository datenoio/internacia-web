import type { APIRoute } from 'astro';
import { json } from '../../../../lib/api';
import { typeDoc } from '../../../../lib/browse';
import { typeById, types } from '../../../../lib/data';

export const getStaticPaths = () => types().map((t) => ({ params: { key: t.id } }));
export const GET: APIRoute = ({ params }) => json(typeDoc(typeById().get(params.key!)!), false);
