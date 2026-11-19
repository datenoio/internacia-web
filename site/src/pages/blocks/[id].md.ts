import type { APIRoute } from 'astro';
import { markdown } from '../../lib/api';
import { aliases, blockById, blocks } from '../../lib/data';
import { blockMarkdown } from '../../lib/markdown';
import { absolute, blockMd } from '../../lib/urls';

export function getStaticPaths() {
  return [
    ...blocks().map((b) => ({ params: { id: b.id.toLowerCase() }, props: { id: b.id, alias: null } })),
    ...aliases()
      .pages.filter((a) => a.section === 'blocks')
      .map((a) => ({ params: { id: a.alias.toLowerCase() }, props: { id: null, alias: a } })),
  ];
}

export const GET: APIRoute = ({ props }) => {
  if (props.alias) {
    const a = props.alias;
    const kind = a.kind === 'redirect' ? `Now: ${absolute(blockMd(a.target))}` : a.kind === 'disambiguation' ? `Possible target: ${a.target} (${absolute(blockMd(a.target))}). Check which entity you mean.` : 'Retired; no replacement.';
    return markdown(`# ${a.alias}\n\n${a.note ?? ''}\n\n${kind}\n`);
  }
  return markdown(blockMarkdown(blockById().get(props.id)!));
};
