import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../../lib/api';
import { aliases, blockById, blocks } from '../../../../lib/data';
import { absolute, blockJson, blockMd, blockPath } from '../../../../lib/urls';

export function getStaticPaths() {
  return [
    ...blocks().map((b) => ({ params: { id: b.id }, props: { id: b.id, alias: null } })),
    ...aliases()
      .pages.filter((a) => a.section === 'blocks')
      .map((a) => ({ params: { id: a.alias }, props: { id: null, alias: a } })),
  ];
}

export const GET: APIRoute = ({ props }) => {
  if (props.alias) {
    const a = props.alias;
    return json({
      meta: apiMeta(),
      redirect: a.target && a.kind === 'redirect' ? absolute(blockJson(a.target)) : null,
      candidate: a.target && a.kind === 'disambiguation' ? absolute(blockJson(a.target)) : null,
      kind: a.kind,
      reason: a.reason,
      since: a.since,
      note: a.note ?? null,
    });
  }
  const b = blockById().get(props.id)!;
  return json({ meta: apiMeta({ html: blockPath(b.id), markdown: blockMd(b.id) }), data: b });
};
