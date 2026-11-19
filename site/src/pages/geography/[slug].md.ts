import type { APIRoute } from 'astro';
import { markdown } from '../../lib/api';
import { areaMarkdown } from '../../lib/browse';
import { geography } from '../../lib/data';

export const getStaticPaths = () => geography().map((a) => ({ params: { slug: a.slug } }));
export const GET: APIRoute = ({ params }) => markdown(areaMarkdown(geography().find((a) => a.slug === params.slug)!));
