// Markdown twins (SPEC §7.3): the same facts as the HTML card, with codes next to names and
// absolute links, so an agent can join without a second lookup.
import { CENTROID_NOTE, LICENSE } from './api';
import {
  CATALOGUE_NOTE,
  COUNTRY_AGREEMENTS_NOTE,
  COVERAGE_NOTE,
  INSTRUMENTS_NOTE,
  PREFERENCE_SCHEME_NOTE,
  PROVISIONAL_NOTE,
  REGISTRY_SCOPE_NOTE,
  agreementFacts,
  agreementStatusLabel,
  agreementTitle,
  agreementTypeLabel,
  coverageLabel,
  instrumentKindLabel,
  instrumentStatusLabel,
  kindSummary,
  partyRoleLabel,
  showsRole,
} from './agreements';
import { blockById, type Agreement, type AgreementRef, type Block, type Country } from './data';
import { BORDER_EVIDENCE_NOTE, borderStatusText, designRows } from './design';
import { blocktypeDeprecated, blocktypeLabel, enumLabel, nativeNameList, num, roleLabel, statusDeprecated, statusLabel, topicLabel, vocabLabel } from './format';
import { meta } from './meta';
import { absolute, agreementJson, agreementPath, blockJson, blockPath, countryJson, countryPath } from './urls';

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

// A "Route role" column only where a row has a role (contract 4.1: pipelines and corridors).
const withRole = <T extends { role: string | null }>(rows: T[], headers: string[], cells: (r: T) => unknown[]): [string[], unknown[][]] =>
  rows.some((r) => r.role)
    ? [[...headers, 'Route role'], rows.map((r) => [...cells(r), roleLabel(r.role)])]
    : [headers, rows.map(cells)];

// A table without the columns that are empty in every row (the first `keep` columns stay).
const compact = (headers: string[], rows: unknown[][], keep: number): [string[], unknown[][]] => {
  const used = headers.map((_, i) => i < keep || rows.some((r) => r[i] !== null && r[i] !== undefined && r[i] !== ''));
  return [headers.filter((_, i) => used[i]), rows.map((r) => r.filter((_, i) => used[i]))];
};

const refText = (r: AgreementRef): string => (r.name ? `${r.name} (${r.id})` : r.id);
// Grantor or beneficiary of a preference scheme (contract 5.1); `party` is left blank.
const shownRole = (role: string | null | undefined): string | undefined => (showsRole(role) ? partyRoleLabel(role) : undefined);

export function countryMarkdown(c: Country): string {
  const current = c._memberships.filter((m) => m.current);
  const former = c._memberships.filter((m) => !m.current);
  const borderNotes = c._borders.filter((b) => b.border_status);
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
      [
        'Land borders',
        c._borders.map(
          (b) =>
            `${b.code ? `${b.name} (${b.code})` : b.iso3code}${b.border_status ? `, ${borderStatusText(b.border_status).toLowerCase()}` : ''}`,
        ),
      ],
      ['Centroid', c.centroid ? `${c.centroid.lat}, ${c.centroid.lng} (ODbL-1.0, mledoze/countries)` : undefined],
    ]),
    borderNotes.length
      ? `\n## Border crossing status\n\nNo entry means no closure is recorded, not that a border was verified open. ${BORDER_EVIDENCE_NOTE}\n\n${table(
          ['Neighbour', 'Status', 'Since', 'Until', 'Note', 'Last verified', 'Sources'],
          borderNotes.map((b) => {
            const s = b.border_status!;
            return [
              b.code ? `${b.name} (${b.code})` : b.iso3code,
              enumLabel('border_status', s.status),
              s.since,
              s.until,
              s.note,
              s.last_verified,
              s.provenance.map((p) => (p.url ? `${p.source} (${p.url})` : p.source)).join('; '),
            ];
          }),
        )}\n`
      : '',
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
    table(...withRole(current, ['ID', 'Organization', 'Type', 'Status', 'Joined'], (m) => [m.block_id, m.block_name, blocktypeLabel(m.blocktype), status(m.status), m.joined])),
    `\n## Former memberships and memberships of historical organizations (${former.length})\n`,
    table(...withRole(former, ['ID', 'Organization', 'Status', 'Joined', 'Left'], (m) => [m.block_id, m.block_name, status(m.status), m.joined, m.left])),
    `\n## Trade agreements (${c._trade_agreements.length})\n\n${
      c._trade_agreements.length ? `${kindSummary(c._trade_agreements, num)}.\n\n` : ''
    }${COUNTRY_AGREEMENTS_NOTE}\n\n${table(
      ...compact(
        ['ID', 'Agreement', 'Type', 'Status', 'Role', 'Provisional application', 'In force', 'Via'],
        c._trade_agreements.map((r) => [
          r.agreement_id,
          r.name,
          agreementTypeLabel(r.agreement_type),
          agreementStatusLabel(r.status),
          shownRole(r.role),
          r.party_provisional_application,
          r.party_in_force ?? r.in_force,
          r.via ? `${r.via_name ?? r.via} (${r.via})` : '',
        ]),
        4,
      ),
    )}\n`,
    c._former_trade_agreements.length
      ? `\n## Former trade agreements (${c._former_trade_agreements.length})\n\n${table(
          ...compact(
            ['ID', 'Agreement', 'Type', 'Status', 'Role', 'Left'],
            c._former_trade_agreements.map((r) => [r.agreement_id, r.name, agreementTypeLabel(r.agreement_type), agreementStatusLabel(r.status), shownRole(r.role), r.left]),
            4,
          ),
        )}\n`
      : '',
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
  const design = designRows(b.institutional_design);
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
      ['Block types', b.blocktype.map((t) => `${blocktypeLabel(t)} (${t}${blocktypeDeprecated(t) ? ', deprecated' : ''})`)],
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
    design.length
      ? `\n## Institutional design\n\nWhat the founding instrument lets the organization decide and enforce. A field that is not listed is unknown.\n\n${facts(
          design.map((row) => [
            row.label,
            row.values.map((v) => (v.country ? (v.country.name ? `${v.country.name} (${v.key})` : v.key) : `${v.label} (\`${v.key}\`)`)),
          ]),
        )}\n`
      : '',
    `\n## ${b._active ? 'Current' : 'Recorded'} participants (${current.length || (b._active ? 0 : b._roster.length)})\n`,
    b.membership_applicability === 'not_applicable' && !b._roster.length
      ? 'This record has no country or organization roster by design (membership not applicable).'
      : table(
          ...withRole(b._active ? current : b._roster, ['Code', 'Name', 'Type', 'Status', 'Joined'], (r) => [
            r.id,
            r.name,
            enumLabel('include_type', r.type),
            status(r.status),
            r.joined,
          ]),
        ),
    b._active && other.length
      ? `\n## Former participants (${other.length})\n\n${table(
          ...withRole(other, ['Code', 'Name', 'Type', 'Status', 'Joined', 'Left'], (r) => [
            r.id,
            r.name,
            enumLabel('include_type', r.type),
            status(r.status),
            r.joined,
            r.left,
          ]),
        )}`
      : '',
    b._trade_agreement || b._party_to_agreements.length
      ? `\n## Trade agreements registry\n\n${facts([
          [
            'Registry record',
            b._trade_agreement
              ? `${b._trade_agreement.agreement_id}, ${agreementStatusLabel(b._trade_agreement.status).toLowerCase()} (${absolute(agreementPath(b._trade_agreement.agreement_id))})`
              : undefined,
          ],
        ])}${
          b._party_to_agreements.length
            ? `\n\n### Agreements this organization is a party to (${b._party_to_agreements.length})\n\n${table(
                ...compact(
                  ['ID', 'Agreement', 'Type', 'Status', 'Role', 'Provisional application', 'In force'],
                  b._party_to_agreements.map((r) => [
                    r.agreement_id,
                    r.name,
                    agreementTypeLabel(r.agreement_type),
                    agreementStatusLabel(r.status),
                    shownRole(r.role),
                    r.provisional_application,
                    r.in_force,
                  ]),
                  4,
                ),
              )}`
            : ''
        }\n`
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

export function agreementMarkdown(a: Agreement): string {
  const parties = a._parties.filter((p) => p.status === 'party');
  const former = a._parties.filter((p) => p.status !== 'party');
  const viaBloc = a._parties.some((p) => p.type === 'intblock');
  const out = [
    frontMatter({
      type: 'trade_agreement',
      id: a.id,
      name: a._name,
      acronym: a._acronym ?? undefined,
      url: absolute(agreementPath(a.id)),
      json: absolute(agreementJson(a.id)),
      wikidata: a.wikidata_id,
      data_version: meta.data.version,
      license: LICENSE,
    }),
    `# ${agreementTitle(a)}\n`,
    a.description ? `${a.description}\n` : '',
    a.verification === 'catalogue' ? `> ${CATALOGUE_NOTE}\n` : '',
    facts(agreementFacts(a).map(([k, v]) => [k, v === '' ? undefined : v])),
    a.provisional_application ? `\n${PROVISIONAL_NOTE}\n` : '',
    `\n${REGISTRY_SCOPE_NOTE}\n`,
    a._alias_notes.length
      ? `\n${a._alias_notes.map((n) => `Until internacia-db v${n.since} this agreement was an intblock record under the same ID (${absolute(blockPath(n.alias))} now leads here).`).join('\n')}\n`
      : '',
    a._block || a._supersedes.length || a._superseded_by || a._parent || a._children.length
      ? `\n## Related records\n\n${facts([
          ['Organization record', a._block ? `${a._block.name ?? a._block.id} (${a._block.id})${a._block.exists ? `: ${absolute(blockPath(a._block.id))}` : ''}` : undefined],
          ['Supersedes', a._supersedes.map(refText)],
          ['Superseded by', a._superseded_by ? refText(a._superseded_by) : undefined],
          ['Part of', a._parent ? refText(a._parent) : undefined],
          [a.agreement_type === 'preference_scheme' ? 'Schemes under it' : 'Records under it', a._children.map(refText)],
        ])}\n`
      : '',
    a.notes ? `\n## Notes\n\n${a.notes}\n` : '',
    `\n## Parties (${parties.length})\n`,
    a.agreement_type === 'preference_scheme' ? `${PREFERENCE_SCHEME_NOTE}\n` : '',
    table(
      ...compact(
        ['Code', 'Name', 'Type', 'Role', 'Signed', 'Provisional application', 'In force', 'Joined'],
        parties.map((p) => [p.id, p.name ?? p.id, enumLabel('party_type', p.type), shownRole(p.role), p.signed, p.provisional_application, p.in_force, p.joined]),
        3,
      ),
    ),
    former.length
      ? `\n## Former parties (${former.length})\n\n${table(
          ...compact(
            ['Code', 'Name', 'Type', 'Role', 'In force', 'Joined', 'Left'],
            former.map((p) => [p.id, p.name ?? p.id, enumLabel('party_type', p.type), shownRole(p.role), p.in_force, p.joined, p.left]),
            3,
          ),
        )}\n`
      : '',
    viaBloc && a._countries.length
      ? `\n## Countries covered (${a._countries.length})\n\n${COVERAGE_NOTE}\n\n${table(
          ...compact(
            ['Code', 'Country', 'Via', 'Role'],
            a._countries.map((c) => [c.code, c.name ?? c.code, c.via ?? 'direct party', shownRole(c.role)]),
            3,
          ),
        )}\n`
      : '',
    a._instruments.length
      ? `\n## Instruments (${a._instruments.length})\n\n${INSTRUMENTS_NOTE}\n\n${table(
          ...compact(
            ['ID', 'Instrument', 'Kind', 'Status', 'Signed', 'In force', 'Ended', 'Covers', 'Notes'],
            a._instruments.map((i) => [
              i.instrument_id,
              i.name ?? i.instrument_id,
              instrumentKindLabel(i.kind),
              instrumentStatusLabel(i.status),
              i.signed,
              i.in_force,
              i.ended,
              coverageLabel(i.coverage),
              i.notes,
            ]),
            4,
          ),
        )}\n`
      : '',
    '\n## Names\n',
    facts([
      ['Acronyms', [...new Set((a.acronyms ?? []).map((x) => `${x.value} (${x.lang})`))]],
      ['Other names', (a.other_names ?? []).map((n) => `${n.name} (${n.lang})`)],
    ]) || '_None recorded._',
    '\n## Links\n',
    (a.links ?? []).map((l) => `- ${enumLabel('link_type', l.type) || l.type}: ${l.url}`).join('\n') || '_None recorded._',
    footer(),
  ];
  // Sections without data are empty strings: leave them out rather than as blank lines.
  return out.filter(Boolean).join('\n');
}

export const blockRefName = (id: string): string => blockById().get(id)?.name ?? id;
