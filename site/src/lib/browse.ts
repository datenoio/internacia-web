// Markdown and JSON forms of the browse pages (block types, topics, geography).
import { apiMeta } from './api';
import { blockById, countryByCode, geography, topics, types, type Area, type Topic, type TypeRecord } from './data';
import { enumLabel } from './format';
import { frontMatter, table } from './markdown';
import { meta } from './meta';
import { absolute, areaPath, blockMd, countryMd, path, topicPath, typePath } from './urls';

const blockRows = (ids: string[]) =>
  ids.map((id) => {
    const b = blockById().get(id)!;
    return [b.id, b.name, b._acronym, b.status + (b._active ? '' : ' (inactive)'), b.founded, b._current_member_count];
  });
const BLOCK_HEAD = ['ID', 'Name', 'Acronym', 'Status', 'Founded', 'Current members'];
const footer = `\nData: internacia-db v${meta.data.version} (${meta.data.release_url}), licensed CC-BY-4.0.\n`;

export function typeMarkdown(t: TypeRecord): string {
  const note = t.deprecated?.note && !(t.description ?? '').includes(t.deprecated.note) ? ` ${t.deprecated.note}` : '';
  return [
    frontMatter({ type: 'blocktype', id: t.id, name: t.name, url: absolute(typePath(t.id)), json: absolute(path(`api/v1/types/${t.id}.json`)), data_version: meta.data.version }),
    `# ${t.name} (block type \`${t.id}\`)\n`,
    t.description ? `${t.description}\n` : '',
    t.deprecated
      ? `**Deprecated** in internacia-db${t.deprecated.removal ? ` (removal: ${t.deprecated.removal})` : ''}.${note}${t.deprecated.replacements?.length ? ` Replacements: ${t.deprecated.replacements.join(', ')}.` : ''}\n`
      : '',
    `${t._count} intblocks (${t._active_count} active); first type of ${t._primary_count}. Intblock cards: ${absolute(blockMd('{id}'))}\n`,
    t.other_names.length ? `Names: ${t.other_names.map((n) => `${n.name} (${n.lang})`).join(', ')}\n` : '',
    `## Founded by decade\n\n${table(['Decade', 'Intblocks'], Object.entries(t._founded_decades).map(([d, n]) => [`${d}s`, n]))}\n`,
    `## Intblocks (${t._count})\n\n${table(BLOCK_HEAD, blockRows(t._blocks))}`,
    footer,
  ].join('\n');
}

export function topicMarkdown(t: Topic): string {
  return [
    frontMatter({ type: 'topic', key: t.key, name: t.name, url: absolute(topicPath(t.key)), json: absolute(path(`api/v1/topics/${t.key}.json`)), data_version: meta.data.version }),
    `# ${t.name} (topic \`${t.key}\`)\n`,
    `${t._count} intblocks (${t._active_count} active).\n`,
    `## Related topics\n\n${table(['Key', 'Topic', 'Shared intblocks'], t._related.map((r) => [r.key, r.name, r.shared]))}\n`,
    `## Intblocks (${t._count})\n\n${table(BLOCK_HEAD, blockRows(t._blocks))}`,
    footer,
  ].join('\n');
}

export function areaMarkdown(a: Area): string {
  return [
    frontMatter({ type: a.kind, name: a.name, slug: a.slug, continent: a._continent ?? undefined, url: absolute(areaPath(a.slug)), json: absolute(path(`api/v1/geography/${a.slug}.json`)), data_version: meta.data.version }),
    `# ${a.name}\n`,
    `${a.kind === 'continent' ? 'Continent' : `Subregion${a._continent ? ` in ${a._continent}` : ''}`}; ${a._countries.length} countries and territories (${a._iso_count} ISO 3166-1).\n`,
    `## Countries and territories (${a._countries.length})\n\n${table(
      ['Code', 'Name', 'Entity type', 'Current memberships', 'Markdown'],
      a._countries.map((code) => {
        const c = countryByCode().get(code)!;
        return [c.code, c.name, enumLabel('entity_type', c.entity_type), c._current_member_count, absolute(countryMd(c.code))];
      }),
    )}\n`,
    `## Intblocks whose regions list “${a.name}” (${a._blocks.length})\n\n${table(BLOCK_HEAD, blockRows(a._blocks))}`,
    footer,
  ].join('\n');
}

export const typeDoc = (t: TypeRecord) => ({ meta: apiMeta({ html: typePath(t.id), markdown: path(`types/${t.id}.md`) }), data: t });
export const topicDoc = (t: Topic) => ({ meta: apiMeta({ html: topicPath(t.key), markdown: path(`topics/${t.key}.md`) }), data: t });
export const areaDoc = (a: Area) => ({ meta: apiMeta({ html: areaPath(a.slug), markdown: path(`geography/${a.slug}.md`) }), data: a });

export const typesIndexMd = () =>
  [
    frontMatter({ type: 'index', section: 'blocktypes', url: absolute(path('types/')), data_version: meta.data.version }),
    `# Block types (${types().length})\n`,
    table(
      ['Key', 'Name', 'Intblocks', 'Active', 'Description', 'Markdown'],
      types().map((t) => [t.id, `${t.name}${t.deprecated ? ' (deprecated)' : ''}`, t._count, t._active_count, t.description, absolute(path(`types/${t.id}.md`))]),
    ),
    footer,
  ].join('\n');

export const topicsIndexMd = () =>
  [
    frontMatter({ type: 'index', section: 'topics', url: absolute(path('topics/')), data_version: meta.data.version }),
    `# Topics (${topics().length})\n`,
    table(['Key', 'Name', 'Intblocks', 'Markdown'], topics().map((t) => [t.key, t.name, t._count, absolute(path(`topics/${t.key}.md`))])),
    footer,
  ].join('\n');

export const geographyIndexMd = () =>
  [
    frontMatter({ type: 'index', section: 'geography', url: absolute(path('geography/')), data_version: meta.data.version }),
    `# Geography\n`,
    table(['Slug', 'Name', 'Kind', 'Continent', 'Countries', 'Intblocks', 'Markdown'], geography().map((a) => [a.slug, a.name, a.kind, a._continent, a._countries.length, a._blocks.length, absolute(path(`geography/${a.slug}.md`))])),
    footer,
  ].join('\n');
