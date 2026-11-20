// Markdown twins (SPEC §7.3): the same facts as the HTML card, with codes next to names and
// absolute links, so an agent can join without a second lookup.
import { CENTROID_NOTE, LICENSE } from './api';
import { blockById, type Block, type Country } from './data';
import { blocktypeLabel, enumLabel, nativeNameList, num, statusDeprecated, statusLabel, topicLabel, vocabLabel } from './format';
import { meta } from './meta';
import { absolute, blockJson, blockPath, countryJson, countryPath } from './urls';

const cell = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export function table(headers: string[], rows: unknown[][]): string {
  if (!rows.length) return '_None._';
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n');
}

export function frontMatter(fields: Record<string, unknown>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? JSON.stringify(v) : v}`);
  return ['---', ...lines, '---', ''].join('\n');
}

const facts = (rows: [string, unknown][]): string =>
  rows
    .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `- **${k}:** ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

// Same wording as the HTML cards: a status that internacia-db deprecates keeps its label.
const status = (value: string): string => `${statusLabel(value)}${statusDeprecated(value) ? ' (deprecated label)' : ''}`;

const footer = () =>
  `\n---\n\nData: internacia-db v${meta.data.version} (${meta.data.release_url}), licensed ${LICENSE}.\n`;

const indicator = (v: Country['population'], unit = '') =>
  v && v.value !== null && v.value !== undefined
    ? `${num(v.value)}${unit} (${v.year ?? 'year unknown'}${v.source ? `, ${v.source}` : ''})`
    : undefined;

export function countryMarkdown(c: Country): string {
  const current = c._memberships.filter((m) => m.current);
  const former = c._memberships.filter((m) => !m.current);
  const out = [
    frontMatter({
      type: 'country',
      code: c.code,
      iso3code: c.iso3code,
      name: c.name,
      url: absolute(countryPath(c.code)),
      json: absolute(countryJson(c.code)),
      wikidata: c.wikidata_id,
      data_version: meta.data.version,
      license: LICENSE,
    }),
    `# ${c.flag_emoji ? `${c.flag_emoji} ` : ''}${c.name} (${c.code})\n`,
    facts([
      ['Official name', c.official_name],
      ['Entity type', enumLabel('entity_type', c.entity_type)],
      ['Code status', `${enumLabel('code_status', c.code_status)} (\`${c.code_status}\`)`],
      ['UN status', enumLabel('un_status', c.un_status)],
      ['Parent entity', c.parent_entity ? `${c.parent_entity.name} (${c.parent_entity.code})` : undefined],
      ['Recognition notes', c.recognition_status?.notes],
    ]),
    '\n## Identifiers\n',
    facts([
      ['ISO 3166-1 alpha-2', c.code],
      ['ISO 3166-1 alpha-3', c.iso3code],
      ['ISO 3166-1 numeric', c.numeric_code],
      ['UN M49', c.m49_code],
      ['Wikidata', c.wikidata_id],
      ['GeoNames', c.geonames_id],
      ['IOC', c.ioc_code],
      ['FIFA', c.fifa_code],
      ['FIPS 10-4 (legacy)', c.fips_code],
      ['Top-level domain', c.tld],
      ['Calling codes', c.calling_codes],
    ]),
    '\n## Geography\n',
    facts([
      ['Continents', c.continents],
      ['UN M49 subregion', c.subregion],
      ['Capital', c.capital_city?.name],
      ['Landlocked', c.landlocked === undefined ? undefined : c.landlocked ? 'yes' : 'no'],
      ['Land borders', c._borders.map((b) => (b.code ? `${b.name} (${b.code})` : b.iso3code))],
      ['Centroid', c.centroid ? `${c.centroid.lat}, ${c.centroid.lng} (ODbL-1.0, mledoze/countries)` : undefined],
    ]),
    '\n## World Bank classification\n',
    c.region
      ? facts([
          ['Region', `${c.region.value} (${c.region.id})`],
          ['Administrative region', c.adminregion ? `${c.adminregion.value} (${c.adminregion.id})` : undefined],
          ['Income level', c.incomeLevel ? `${c.incomeLevel.value} (${c.incomeLevel.id})` : undefined],
          ['Lending type', c.lendingType ? `${c.lendingType.value} (${c.lendingType.id})` : undefined],
        ])
      : 'Not classified by the World Bank.',
    '\n## Languages and practical reference\n',
    facts([
      ['Languages', (c.languages ?? []).map((l) => `${l.name} (${l.code})${l.official ? ', official' : ''}`)],
      [
        'Native names',
        nativeNameList(c.native_names)
          .map((n) => `${n.names.join(' — ')} (${n.language === n.lang ? n.lang : `${n.language}, ${n.lang}`})`)
          .join('; '),
      ],
      ['Currencies', (c.currencies ?? []).map((x) => `${x.name ?? x.code} (${x.code})`)],
      ['Time zones', c.timezones],
      ['Driving side', c.car_side],
      ['Start of week', c.start_of_week],
      ['Writing systems', (c.writing_systems ?? []).map((w) => vocabLabel('writing_systems', w.id))],
      ['Legal systems', (c.legal_systems ?? []).map((w) => vocabLabel('legal_systems', w.id))],
      ['Population', indicator(c.population)],
      ['Land area', indicator(c.area, ' km²')],
      ['Gini index', indicator(c.gini)],
    ]),
    `\n## Current memberships (${current.length})\n`,
    table(
      ['ID', 'Organization', 'Type', 'Status', 'Joined'],
      current.map((m) => [m.block_id, m.block_name, blocktypeLabel(m.blocktype), status(m.status), m.joined]),
    ),
    `\n## Former memberships and memberships of historical organizations (${former.length})\n`,
    table(
      ['ID', 'Organization', 'Status', 'Joined', 'Left'],
      former.map((m) => [m.block_id, m.block_name, status(m.status), m.joined, m.left]),
    ),
    '\n## Most similar countries by shared current memberships\n',
    table(['Code', 'Country', 'Shared', 'Jaccard'], c._similar.map((s) => [s.code, s.name, s.shared, s.jaccard])),
    c.centroid ? `\n${CENTROID_NOTE}\n` : '',
    footer(),
  ];
  return out.join('\n');
}

export function blockMarkdown(b: Block): string {
  const current = b._roster.filter((r) => r.current);
  const other = b._roster.filter((r) => !r.current);
  const hq = b.headquarters;
  const out = [
    frontMatter({
      type: 'intblock',
      id: b.id,
      name: b.name,
      acronym: b._acronym ?? undefined,
      url: absolute(blockPath(b.id)),
      json: absolute(blockJson(b.id)),
      wikidata: b.wikidata_id,
      data_version: meta.data.version,
      license: LICENSE,
    }),
    `# ${b.name}${b._acronym ? ` (${b._acronym})` : ''}\n`,
    b.description ? `${b.description}\n` : '',
    facts([
      ['ID', b.id],
      ['Status', `${enumLabel('status', b.status)}${b._active ? '' : ' (not active)'}`],
      ['Scope category', enumLabel('scope_category', b.scope_category)],
      ['Geographic scope', enumLabel('geographic_scope', b.geographic_scope)],
      ['Block types', b.blocktype.map((t) => `${blocktypeLabel(t)} (${t})`)],
      ['Topics', (b.topics ?? []).map((t) => topicLabel(t.key, t.name))],
      ['Regions', b.regions],
      ['Founded', b.founded],
      ['Dissolved', b.dissolved],
      ['Headquarters', hq?.city ? `${hq.city}${hq.country ? `, ${b._hq_country_name ?? hq.country} (${hq.country})` : ''}` : undefined],
      ['Official languages', b.languages],
      ['Legal status', b.legal_status],
      ['Recognition', b.recognition_status],
      [
        'Official member count',
        b.membership_count !== undefined
          ? `${b.membership_count}${b.membership_count_type ? ` ${b.membership_count_type}` : ''}`
          : undefined,
      ],
      ['Last verified', b.last_verified],
    ]),
    b.notes ? `\n## Notes\n\n${b.notes}\n` : '',
    `\n## ${b._active ? 'Current' : 'Recorded'} participants (${current.length || (b._active ? 0 : b._roster.length)})\n`,
    b.membership_applicability === 'not_applicable' && !b._roster.length
      ? 'This record has no country or organization roster by design (membership not applicable).'
      : table(
          ['Code', 'Name', 'Type', 'Status', 'Joined'],
          (b._active ? current : b._roster).map((r) => [r.id, r.name, enumLabel('include_type', r.type), status(r.status), r.joined]),
        ),
    b._active && other.length
      ? `\n## Former participants (${other.length})\n\n${table(
          ['Code', 'Name', 'Type', 'Status', 'Joined', 'Left'],
          other.map((r) => [r.id, r.name, enumLabel('include_type', r.type), status(r.status), r.joined, r.left]),
        )}`
      : '',
    '\n## Structure\n',
    facts([
      ['Part of', b._parents.map((p) => (p.name ? `${p.name} (${p.id})` : p.id))],
      ['Suborganizations', b._children.map((c) => (c.name ? `${c.name} (${c.id})` : c.id))],
      ['Predecessor', b._predecessor ? `${b._predecessor.name ?? ''} (${b._predecessor.id})` : undefined],
      ['Successor', b._successor ? `${b._successor.name ?? ''} (${b._successor.id})` : undefined],
      ['Previous names', (b.previous_names ?? []).map((p) => `${p.name}${p.period ? ` (${p.period})` : ''}`)],
    ]) || '_None recorded._',
    '\n## Most overlapping organizations by current member countries\n',
    table(['ID', 'Name', 'Shared', 'Jaccard'], b._similar.map((s) => [s.id, s.name, s.shared, s.jaccard])),
    '\n## Names\n',
    facts([
      ['Acronyms', [...new Set((b.acronyms ?? []).map((a) => `${a.value} (${a.lang})`))]],
      ['Other names', (b.other_names ?? []).map((n) => `${n.name} (${n.id})`)],
    ]) || '_None recorded._',
    '\n## Links\n',
    [...(b.links ?? []).map((l) => `- ${l.type}: ${l.url}`), ...(b.official_documents ?? []).map((d) => `- document: ${d.url}`)].join('\n') ||
      '_None recorded._',
    footer(),
  ];
  return out.join('\n');
}

export const blockRefName = (id: string): string => blockById().get(id)?.name ?? id;
