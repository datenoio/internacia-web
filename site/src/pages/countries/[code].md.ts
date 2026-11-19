import type { APIRoute } from 'astro';
import { markdown } from '../../lib/api';
import { aliases, countries, countryByCode } from '../../lib/data';
import { countryMarkdown } from '../../lib/markdown';
import { absolute, countryPath } from '../../lib/urls';

export function getStaticPaths() {
  return [
    ...countries().map((c) => ({ params: { code: c.code.toLowerCase() }, props: { code: c.code, alias: null } })),
    ...aliases()
      .pages.filter((a) => a.section === 'countries')
      .map((a) => ({ params: { code: a.alias.toLowerCase() }, props: { code: null, alias: a } })),
  ];
}

export const GET: APIRoute = ({ props }) => {
  if (props.alias) {
    const a = props.alias;
    const target = a.target ? `${absolute(countryPath(a.target)).replace(/\/$/, '')}.md` : null;
    return markdown(`# ${a.alias}\n\n${a.note ?? ''}\n\n${target ? `Now: ${target}` : 'Retired; no replacement.'}\n`);
  }
  return markdown(countryMarkdown(countryByCode().get(props.code)!));
};
