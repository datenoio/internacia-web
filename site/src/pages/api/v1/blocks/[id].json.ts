import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../../lib/api';
import { aliases, blockById, blocks } from '../../../../lib/data';
import { absolute, agreementJson, blockJson, blockMd, blockPath } from '../../../../lib/urls';

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
    // An intblock moved to the trade agreements registry (contract 5.0) keeps its ID there.
    const target = (id: string) => (a.target_section === 'agreements' ? agreementJson(id) : blockJson(id));
    return json({
      meta: apiMeta(),
      redirect: a.target && a.kind === 'redirect' ? absolute(target(a.target)) : null,
      candidate: a.target && a.kind === 'disambiguation' ? absolute(blockJson(a.target)) : null,
      kind: a.kind,
      target_dataset: a.target_dataset ?? null,
      reason: a.reason,
      since: a.since,
      note: a.note ?? null,
    }, false);
  }
  const b = blockById().get(props.id)!;
  return json({ meta: apiMeta({ html: blockPath(b.id), markdown: blockMd(b.id) }), data: b }, false);
};
