import type { APIRoute } from 'astro';
import { markdown } from '../../lib/api';
import { typeMarkdown } from '../../lib/browse';
import { typeById, types } from '../../lib/data';

export const getStaticPaths = () => types().map((t) => ({ params: { key: t.id } }));
export const GET: APIRoute = ({ params }) => markdown(typeMarkdown(typeById().get(params.key!)!));
