import type { APIRoute } from 'astro';
import { json } from '../../../../lib/api';
import { areaDoc } from '../../../../lib/browse';
import { geography } from '../../../../lib/data';

export const getStaticPaths = () => geography().map((a) => ({ params: { slug: a.slug } }));
export const GET: APIRoute = ({ params }) => json(areaDoc(geography().find((a) => a.slug === params.slug)!));
