import type { APIRoute } from 'astro';
import { blockById, blocks, countries, countryByCode } from '../../lib/data';
import { blockImage, countryImage, defaultImage } from '../../lib/og';

// /og/countries/{code}.png, /og/blocks/{id}.png (lowercase), /og/default.png
export function getStaticPaths() {
  return [
    { params: { slug: 'default' }, props: { kind: 'default', id: '' } },
    ...countries().map((c) => ({ params: { slug: `countries/${c.code.toLowerCase()}` }, props: { kind: 'country', id: c.code } })),
    ...blocks().map((b) => ({ params: { slug: `blocks/${b.id.toLowerCase()}` }, props: { kind: 'block', id: b.id } })),
  ];
}

export const GET: APIRoute = async ({ props }) => {
  const body =
    props.kind === 'country'
      ? await countryImage(countryByCode().get(props.id)!)
      : props.kind === 'block'
        ? await blockImage(blockById().get(props.id)!)
        : await defaultImage(countries());
  return new Response(body, { headers: { 'Content-Type': 'image/png' } });
};
