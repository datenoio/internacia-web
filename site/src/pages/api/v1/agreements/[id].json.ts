import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../../lib/api';
import { agreementById, agreements } from '../../../../lib/data';
import { agreementMd, agreementPath } from '../../../../lib/urls';

export function getStaticPaths() {
  return agreements().map((a) => ({ params: { id: a.id }, props: { id: a.id } }));
}

export const GET: APIRoute = ({ props }) => {
  const a = agreementById().get(props.id)!;
  return json({ meta: apiMeta({ html: agreementPath(a.id), markdown: agreementMd(a.id) }), data: a }, false);
};
