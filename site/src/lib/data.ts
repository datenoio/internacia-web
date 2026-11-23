// Data written by pipeline/build_data.py into src/generated/. Read once per build.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GENERATED = join(process.cwd(), 'src', 'generated');

function load<T>(name: string): T {
  try {
    return JSON.parse(readFileSync(join(GENERATED, name), 'utf-8')) as T;
  } catch (error) {
    throw new Error(
      `src/generated/${name} could not be read (${(error as Error).message}). Run ` +
        '`python pipeline/fetch.py` and `python pipeline/build_data.py` from the repository root first.',
    );
  }
}

function once<T>(fn: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= fn());
}

export interface IdValue {
  id: string;
  value: string;
}

export interface Indicator {
  value: number | null;
  year: number | null;
  source?: string;
  source_id?: string;
}

export interface Provenance {
  field?: string;
  source?: string;
  url?: string;
  retrieved_at?: string;
  license?: string;
  note?: string;
}

export interface AliasNote {
  alias: string;
  target: string | null;
  reason: string;
  since: string;
  note?: string;
  // intblocks_aliases (contract 5.0): `trade_agreements` for reason `moved`.
  target_dataset?: string | null;
  section: 'blocks' | 'countries';
  // Section of the target: an intblock moved to the trade agreements registry (contract 5.0)
  // redirects to its agreement card.
  target_section: 'blocks' | 'countries' | 'agreements';
  kind: 'reused' | 'former_id' | 'redirect' | 'disambiguation' | 'retired';
}

// Trade agreements registry (contract 5.0). One row per agreement on a country or intblock card.
export interface AgreementRow {
  agreement_id: string;
  name: string;
  acronym: string | null;
  agreement_type: string | null;
  status: string | null;
  signed: string | null;
  in_force: string | null;
  ended: string | null;
  verification: string | null;
}

// country_trade_agreements view: current coverage; `via` is the bloc a country is covered through.
export interface CountryAgreement extends AgreementRow {
  party_in_force: string | null;
  via: string | null;
  via_name: string | null;
}

export interface FormerCountryAgreement extends AgreementRow {
  joined: string | null;
  left: string | null;
}

export interface AgreementParty {
  id: string;
  name: string | null;
  type: string;
  status: string;
  signed: string | null;
  in_force: string | null;
  joined: string | null;
  left: string | null;
  note: string | null;
  source: string | null;
  link: 'country' | 'block' | null;
  flag_emoji: string | null;
}

export interface AgreementRef {
  id: string;
  name: string | null;
  exists: boolean;
}

export interface Agreement {
  id: string;
  name: string | null;
  agreement_type: string | null;
  status: string | null;
  signed: string | null;
  in_force: string | null;
  ended: string | null;
  intblock_id: string | null;
  party_count: number | null;
  supersedes: string | null;
  superseded_by: string | null;
  wto_rta_id: number | null;
  aric_id: number | null;
  wikidata_id: string | null;
  acronyms: { lang: string; value: string }[] | null;
  other_names: { lang: string; name: string }[] | null;
  links: { url: string; type: string }[] | null;
  description: string | null;
  notes: string | null;
  verification: string | null;
  last_verified: string | null;
  provenance: Provenance[] | null;
  _name: string;
  _acronym: string | null;
  _party_count: number;
  _parties: AgreementParty[];
  _countries: { code: string; name: string | null; flag_emoji: string | null; via: string | null; in_force: string | null }[];
  _block: BlockRef | null;
  _supersedes: AgreementRef[];
  _superseded_by: AgreementRef | null;
  _alias_notes: AliasNote[];
  _source_path: string;
  [key: string]: unknown;
}

export interface CountryMembership {
  block_id: string;
  block_name: string;
  acronym: string | null;
  blocktype: string;
  block_status: string;
  status: string;
  joined: string | null;
  left: string | null;
  // includes[].role (contract 4.1): what the country does on a pipeline or corridor route.
  role: string | null;
  note: string | null;
  current: boolean;
}

export interface BorderStatus {
  status: string | null;
  since: string | null;
  until: string | null;
  note: string | null;
  last_verified: string | null;
  provenance: Provenance[];
}

export interface Border {
  iso3code: string;
  code: string | null;
  name: string | null;
  // Current crossing status (closed, restricted; open enum). Null when no closure is recorded,
  // which does not mean the border is verified open.
  status: string | null;
  border_status: BorderStatus | null;
}

export interface Country {
  code: string;
  name: string;
  iso3code: string;
  numeric_code?: string;
  m49_code?: string;
  official_name?: string;
  flag_emoji?: string;
  wikidata_id?: string;
  geonames_id?: string;
  ioc_code?: string;
  fifa_code?: string;
  fips_code?: string;
  tld?: string;
  calling_codes?: string[];
  capital_city?: { name?: string; lat?: number; lng?: number };
  region?: IdValue;
  adminregion?: IdValue;
  incomeLevel?: IdValue;
  lendingType?: IdValue;
  continents?: string[];
  subregion?: string;
  borders?: string[];
  landlocked?: boolean;
  centroid?: { lat: number; lng: number };
  bbox?: { west: number; east: number; north: number; south: number };
  un_member?: boolean;
  un_status?: string;
  independent?: boolean;
  entity_type: string;
  code_status: string;
  recognition_status?: { status?: string; un_member?: boolean; notes?: string };
  parent_entity?: { code: string; name: string };
  languages?: { code: string; name: string; official?: boolean }[];
  // Contract 4: keys are the entity's own languages; either name may be missing.
  native_names?: Record<string, { official?: string | null; common?: string | null }>;
  demonyms?: { female?: string; male?: string };
  writing_systems?: { id: string; primary?: boolean }[];
  writing_directions?: { id: string; primary?: boolean }[];
  currencies?: { code: string; name?: string; symbol?: string }[];
  timezones?: string[];
  timezone_status?: string;
  car_side?: string;
  start_of_week?: string;
  dvd_region?: number;
  broadcast_systems?: { id: string }[];
  rail_gauges?: { id: string }[];
  legal_systems?: { id: string }[];
  population?: Indicator | null;
  area?: Indicator | null;
  gini?: Indicator | null;
  other_names?: { id: string; name: string }[];
  common_names?: string[];
  provenance?: Provenance[];
  _current_member_count: number;
  _status_counts: Record<string, number>;
  _blocktype_counts: Record<string, number>;
  _memberships: CountryMembership[];
  _similar: { code: string; name: string; shared: number; jaccard: number; flag_emoji?: string }[];
  _borders: Border[];
  _parent_exists: boolean;
  _dependents: { code: string; name: string }[];
  _alias_notes: AliasNote[];
  _trade_agreements: CountryAgreement[];
  _former_trade_agreements: FormerCountryAgreement[];
  _source_path: string;
  [key: string]: unknown;
}

export interface RosterEntry {
  id: string;
  name: string | null;
  type: string;
  status: string;
  joined: string | null;
  left: string | null;
  role: string | null;
  note: string | null;
  current: boolean;
  link: 'country' | 'block' | null;
  flag_emoji: string | null;
}

export interface BlockRef {
  id: string;
  name: string | null;
  exists: boolean;
}

// Contract 4.1: what the founding instrument lets an organization decide and enforce. An absent
// object or subfield means unknown, never "none".
export interface InstitutionalDesign {
  mandate?: string | null;
  decision_rule?: string | null;
  decision_force?: string | null;
  independent_organs?: string[] | null;
  enforcement?: string[] | null;
  mutual_defence?: boolean | null;
  veto_holders?: string[] | null;
}

export interface Block {
  id: string;
  name: string;
  blocktype: string[];
  status: string;
  scope_category?: string;
  geographic_scope?: string;
  regions?: string[];
  languages?: string[];
  links?: { url: string; type: string }[];
  includes?: unknown[];
  founded?: string;
  dissolved?: string;
  active_period?: { start?: string; end?: string };
  headquarters?: { city?: string; country?: string; coordinates?: { lat: number; lng: number }; note?: string };
  secretariat?: { location?: string; organization?: string };
  acronyms?: { lang: string; value: string }[];
  wikidata_id?: string;
  membership_count?: number;
  membership_count_type?: string;
  membership_applicability?: string;
  founding_members?: string[];
  last_verified?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  topics?: { key: string; name: string }[];
  other_names?: { id: string; name: string }[];
  provenance?: Provenance[];
  legal_status?: string;
  recognition_status?: string;
  previous_names?: { id?: string; name: string; period?: string }[];
  official_documents?: { url: string; type?: string; title?: string }[];
  social_media?: Record<string, string>;
  institutional_design?: InstitutionalDesign | null;
  _acronym: string | null;
  _active: boolean;
  _current_member_count: number;
  _status_counts: Record<string, number>;
  _roster: RosterEntry[];
  _parents: BlockRef[];
  _children: BlockRef[];
  _predecessor: BlockRef | null;
  _successor: BlockRef | null;
  _similar: { id: string; name: string; acronym: string | null; shared: number; jaccard: number }[];
  _hq_country_name: string | null;
  _alias_notes: AliasNote[];
  // Trade agreements registry (contract 5.0): the record linked to this intblock, and the
  // agreements it is a party to as a bloc.
  _trade_agreement: (AgreementRow & { wto_rta_id: number | null }) | null;
  _party_to_agreements: (AgreementRow & { party_status: string | null })[];
  _source_path: string;
  [key: string]: unknown;
}

export interface Deprecation {
  replacements?: string[] | null;
  removal?: string | null;
  note?: string | null;
}

export interface BlockType {
  id: string;
  name: string;
  description?: string | null;
  deprecated?: Deprecation | null;
  other_names: { lang: string; name: string }[];
  _count: number;
}

export interface DesignField {
  name: string;
  kind: string | null;
  description: string;
  values: Record<string, { name: string; description: string }>;
}

export interface Labels {
  statuses: Record<string, { name: string; description: string; deprecated: boolean }>;
  topics: Record<string, string>;
  vocabs: Record<string, Record<string, string>>;
  native_name_languages: Record<string, string>;
  include_roles: Record<string, { name: string; description: string; blocktypes: string[] }>;
  institutional_design: Record<string, DesignField>;
}

export interface AliasPage extends AliasNote {}

export interface Aliases {
  pages: AliasPage[];
  intblocks: unknown[];
  countries: unknown[];
}

export interface Download {
  name: string;
  format: string | null;
  bytes: number | null;
  sha256: string | null;
  url: string;
}

export interface TypeRecord {
  id: string;
  name: string;
  description: string | null;
  deprecated: Deprecation | null;
  other_names: { lang: string; name: string }[];
  _count: number;
  _active_count: number;
  _primary_count: number;
  _blocks: string[];
  _founded_decades: Record<string, number>;
  _undated: number;
}

export interface Topic {
  key: string;
  name: string;
  _count: number;
  _active_count: number;
  _blocks: string[];
  _related: { key: string; name: string; shared: number }[];
}

export interface Area {
  slug: string;
  kind: 'continent' | 'subregion';
  name: string;
  _continent: string | null;
  _countries: string[];
  _iso_count: number;
  _blocks: string[];
}

export interface CompletenessRow {
  field: string;
  filled: number;
  total: number;
  share: number;
  missing: string[];
  gate?: { max_null_rate: number; mode: string | null; requirement: string | null; priority: string | null; met: boolean };
}

export interface Stats {
  countries: { completeness: CompletenessRow[]; by_entity_type: Record<string, number>; by_code_status: Record<string, number> };
  intblocks: {
    completeness: CompletenessRow[];
    by_status: Record<string, number>;
    by_scope_category: Record<string, number>;
    by_geographic_scope: Record<string, number>;
    founded_decades: Record<string, number>;
    last_verified_months: Record<string, number>;
    active: number;
  };
  memberships: {
    by_status: Record<string, number>;
    by_include_type: Record<string, number>;
    with_joined: number;
    with_left: number;
    by_role: Record<string, number>;
  };
}

export interface ReleaseInfo {
  tag: string;
  name: string;
  published_at: string | null;
  url: string | null;
  body: string;
}

export const countries = once(() => load<Country[]>('countries.json'));
export const blocks = once(() => load<Block[]>('blocks.json'));
export const agreements = once(() => load<Agreement[]>('agreements.json'));
export const blocktypes = once(() => load<BlockType[]>('blocktypes.json'));
export const labels = once(() => load<Labels>('labels.json'));
export const aliases = once(() => load<Aliases>('aliases.json'));
export const downloads = once(() => load<Download[]>('downloads.json'));

export const types = once(() => load<TypeRecord[]>('types.json'));
export const topics = once(() => load<Topic[]>('topics.json'));
export const geography = once(() => load<Area[]>('geography.json'));
export const stats = once(() => load<Stats>('stats.json'));
export const releases = once(() => load<ReleaseInfo[]>('releases.json'));

export const typeById = once(() => new Map(types().map((t) => [t.id, t])));
export const topicByKey = once(() => new Map(topics().map((t) => [t.key, t])));
export const areaByName = once(() => new Map(geography().map((a) => [`${a.kind}:${a.name}`, a])));

export const countryByCode = once(() => new Map(countries().map((c) => [c.code, c])));
export const blockById = once(() => new Map(blocks().map((b) => [b.id, b])));
export const agreementById = once(() => new Map(agreements().map((a) => [a.id, a])));
export const blocktypeById = once(() => new Map(blocktypes().map((t) => [t.id, t])));
