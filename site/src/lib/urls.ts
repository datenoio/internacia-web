// URL scheme (SPEC §5.1–5.2). HTML paths are lowercase with a trailing slash; JSON paths keep the
// exact ID so agents can build them from data.
import { SITE_URL } from '../../site.config.mjs';
import { meta } from './meta';

export const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export const path = (p = ''): string => `${BASE}${p.replace(/^\//, '')}`;
// Braces survive so URL templates such as {code} stay readable in llms.txt and the API index.
export const absolute = (p: string): string => new URL(p, SITE_URL).href.replace(/%7B/gi, '{').replace(/%7D/gi, '}');

export const countryPath = (code: string) => path(`countries/${code.toLowerCase()}/`);
export const countryMd = (code: string) => path(`countries/${code.toLowerCase()}.md`);
export const countryJson = (code: string) => path(`api/v1/countries/${code}.json`);

export const blockPath = (id: string) => path(`blocks/${id.toLowerCase()}/`);
export const blockMd = (id: string) => path(`blocks/${id.toLowerCase()}.md`);
export const blockJson = (id: string) => path(`api/v1/blocks/${id}.json`);

export const typePath = (key: string) => path(`types/${key}/`);
export const topicPath = (key: string) => path(`topics/${key}/`);
export const areaPath = (slug: string) => path(`geography/${slug}/`);

export const REPO_DATA = `https://github.com/${meta.data.repository}`;
export const REPO_SITE = 'https://github.com/datenoio/internacia-web';

export const sourceUrl = (sourcePath: string) => `${REPO_DATA}/blob/${meta.data.tag}/${sourcePath}`;

export function reportErrorUrl(dataset: 'countries' | 'intblocks', id: string, name: string): string {
  const params = new URLSearchParams({
    template: 'data_error.yml',
    title: `[data] ${id}: ${name}`,
    record_id: id,
  });
  return `${REPO_DATA}/issues/new?${params.toString()}`;
}

export const wikidataUrl = (id: string) => `https://www.wikidata.org/wiki/${id}`;
export const geonamesUrl = (id: string) => `https://www.geonames.org/${id}`;
