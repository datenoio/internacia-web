import type { APIRoute } from 'astro';
import { apiMeta, CENTROID_NOTE, json } from '../../../../lib/api';
import { aliases, countries, countryByCode } from '../../../../lib/data';
import { absolute, countryJson, countryMd, countryPath } from '../../../../lib/urls';

export function getStaticPaths() {
  return [
    ...countries().map((c) => ({ params: { code: c.code }, props: { code: c.code, alias: null } })),
    ...aliases()
      .pages.filter((a) => a.section === 'countries')
      .map((a) => ({ params: { code: a.alias }, props: { code: null, alias: a } })),
  ];
}

export const GET: APIRoute = ({ props }) => {
  if (props.alias) {
    const a = props.alias;
    return json({
      meta: apiMeta(),
      redirect: a.target && a.kind === 'redirect' ? absolute(countryJson(a.target)) : null,
      kind: a.kind,
      reason: a.reason,
      since: a.since,
      note: a.note ?? null,
    }, false);
  }
  const c = countryByCode().get(props.code)!;
  return json({
    meta: apiMeta({ html: countryPath(c.code), markdown: countryMd(c.code), notes: c.centroid ? [CENTROID_NOTE] : [] }),
    data: c,
  }, false);
};
