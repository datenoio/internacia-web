import type { APIRoute } from 'astro';
import { markdown } from '../../lib/api';
import { agreementById, agreements } from '../../lib/data';
import { agreementMarkdown } from '../../lib/markdown';

export function getStaticPaths() {
  return agreements().map((a) => ({ params: { id: a.id.toLowerCase() }, props: { id: a.id } }));
}

export const GET: APIRoute = ({ props }) => markdown(agreementMarkdown(agreementById().get(props.id)!));
