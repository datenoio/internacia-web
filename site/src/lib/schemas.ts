// JSON Schemas (2020-12) for the static API and its OpenAPI 3.1 description (SPEC §7.4).
// Entity schemas pin the identifiers and the derived `_` fields the site adds; other export
// fields are allowed through (additionalProperties), because internacia-db adds fields in MINOR
// releases. Each schema is self-contained so it validates without fetching others.
import { meta } from './meta';
import { absolute, path } from './urls';

type Schema = Record<string, unknown>;

export const schemaUrl = (name: string) => absolute(path(`api/v1/schemas/${name}.schema.json`));

const str = { type: 'string' };
const strOrNull = { type: ['string', 'null'] };
const int = { type: 'integer', minimum: 0 };
const bool = { type: 'boolean' };
const url = { type: 'string', format: 'uri' };

const metaDef: Schema = {
  type: 'object',
  required: ['data_version', 'contract_version', 'built_at', 'license', 'source', 'api'],
  properties: {
    data_version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$', description: 'internacia-db release the document was built from.' },
    contract_version: { type: 'string', pattern: '^\\d+\\.\\d+$' },
    built_at: { type: 'string', description: 'Build time of the internacia-db release (not of the site).' },
    license: { const: 'CC-BY-4.0' },
    source: url,
    html: url,
    markdown: url,
    api: url,
    license_notes: { type: 'array', items: str },
  },
  additionalProperties: false,
};

// population and area (SPEC §4.4): value with year (null when unknown) and source.
const indicator = {
  type: ['object', 'null'],
  required: ['value', 'year', 'source', 'source_id'],
  properties: { value: { type: 'number' }, year: { type: ['integer', 'null'] }, source: strOrNull, source_id: strOrNull },
  additionalProperties: false,
};

const idValue = { type: 'object', required: ['id', 'value'], properties: { id: str, value: str } };

const membership: Schema = {
  type: 'object',
  required: ['block_id', 'block_name', 'blocktype', 'status', 'current'],
  properties: {
    block_id: str,
    block_name: str,
    acronym: strOrNull,
    blocktype: str,
    block_status: str,
    status: str,
    joined: strOrNull,
    left: strOrNull,
    role: { ...strOrNull, description: 'includes[].role: origin, transit, destination (pipelines) or terminal, transit (corridors); open enum. Null elsewhere.' },
    note: strOrNull,
    current: bool,
  },
  additionalProperties: false,
};

const rosterEntry: Schema = {
  type: 'object',
  required: ['id', 'type', 'status', 'current', 'link'],
  properties: {
    id: str,
    name: strOrNull,
    type: { type: 'string', description: 'country, territory, organization or historical-country (open enum).' },
    status: str,
    joined: strOrNull,
    left: strOrNull,
    role: { ...strOrNull, description: 'includes[].role: origin, transit, destination (pipelines) or terminal, transit (corridors); open enum. Null elsewhere.' },
    note: strOrNull,
    current: bool,
    link: { enum: ['country', 'block', null], description: 'Which card the entry links to, if any. historical-country entries never link.' },
    flag_emoji: strOrNull,
  },
  additionalProperties: false,
};

const blockRef = {
  type: ['object', 'null'],
  required: ['id', 'exists'],
  properties: { id: str, name: strOrNull, exists: bool },
  additionalProperties: false,
};

const aliasNote = {
  type: 'object',
  required: ['alias', 'reason', 'since', 'kind', 'section'],
  properties: {
    alias: str,
    target: strOrNull,
    reason: str,
    since: str,
    note: str,
    target_dataset: { ...strOrNull, description: 'intblocks_aliases.target_dataset (contract 5.0): trade_agreements for reason moved.' },
    section: { enum: ['blocks', 'countries'] },
    target_section: { enum: ['blocks', 'countries', 'agreements'], description: 'Section of the target card: agreements for an intblock moved to the trade agreements registry.' },
    kind: { enum: ['reused', 'former_id', 'redirect', 'disambiguation', 'retired'] },
  },
};

// Trade agreements registry (contract 5.0): one agreement as country and intblock cards list it.
const roleProp = {
  ...strOrNull,
  description: 'Contract 5.1: grantor or beneficiary on a non-reciprocal preference scheme, party on every other agreement (open enum).',
};
const agreementRowProps = {
  agreement_id: str,
  name: str,
  acronym: strOrNull,
  agreement_type: {
    ...strOrNull,
    description: 'fta, customs_union, pta, preference_scheme, services, investment, trade_relations, digital, framework, other (open enum; investment and trade_relations from contract 5.1).',
  },
  status: {
    ...strOrNull,
    description: "The agreement's own status: proposed, negotiating, suspended, signed, in_force, terminated, abandoned, superseded (open enum; suspended from contract 5.1).",
  },
  signed: strOrNull,
  provisional_application: { ...strOrNull, description: 'Contract 5.1: the date the agreement began to apply provisionally. An agreement applied only provisionally has no in_force.' },
  in_force: { ...strOrNull, description: 'Definitive entry into force (contract 5.1; catalogue records may hold a provisional date).' },
  ended: strOrNull,
  verification: {
    ...strOrNull,
    description:
      'official (checked against the treaty text, a depositary or a party government) or catalogue (WTO RTA-IS, the WTO PTA Database, ADB ARIC, GPTAD, the UNCTAD IIA Navigator, EDIT or the UN Treaty Series only).',
  },
};
const countryAgreement = {
  type: 'object',
  required: ['agreement_id', 'name', 'status', 'via'],
  properties: {
    ...agreementRowProps,
    role: roleProp,
    party_provisional_application: { ...strOrNull, description: 'provisional_application of the country_trade_agreements view: the party date, else the agreement date.' },
    party_in_force: { ...strOrNull, description: 'in_force of the country_trade_agreements view: the party date, else the agreement date.' },
    via: { ...strOrNull, description: 'Intblock ID of the bloc party the country is covered through (its current members), or null for a direct party.' },
    via_name: strOrNull,
  },
  additionalProperties: false,
};
const formerCountryAgreement = {
  type: 'object',
  required: ['agreement_id', 'name', 'status'],
  properties: { ...agreementRowProps, role: roleProp, joined: strOrNull, left: strOrNull },
  additionalProperties: false,
};
const agreementRef = blockRef;
const agreementParty = {
  type: 'object',
  required: ['id', 'type', 'status', 'link'],
  properties: {
    id: str,
    name: strOrNull,
    type: { type: 'string', description: 'country, territory, intblock or historical-country (open enum).' },
    role: roleProp,
    status: { type: 'string', description: 'party or former_party (open enum).' },
    signed: strOrNull,
    provisional_application: strOrNull,
    in_force: strOrNull,
    joined: strOrNull,
    left: strOrNull,
    note: strOrNull,
    source: { ...strOrNull, description: "record, or intblock when read from the linked intblock's includes." },
    link: { enum: ['country', 'block', null], description: 'Which card the party links to, if any. historical-country entries never link.' },
    flag_emoji: strOrNull,
  },
  additionalProperties: false,
};
const agreement: Schema = {
  type: 'object',
  required: ['id', 'agreement_type', 'status', 'verification', '_name', '_party_count', '_parties', '_countries'],
  properties: {
    id: { type: 'string', pattern: '^[A-Za-z0-9_+-]+$', description: 'Registry ID; primary key, case-sensitive. A record linked to an intblock has the intblock ID.' },
    name: strOrNull,
    agreement_type: strOrNull,
    status: strOrNull,
    intblock_id: { ...strOrNull, description: 'The intblock that holds the roster of an agreement with three or more parties.' },
    provisional_application: agreementRowProps.provisional_application,
    in_force: agreementRowProps.in_force,
    parent: { ...strOrNull, description: 'Contract 5.1: the preference scheme a sub-scheme belongs to (GSP → EU-GSP → EU-GSP-EBA).' },
    wto_rta_id: { type: ['integer', 'null'] },
    aric_id: { type: ['integer', 'null'] },
    wto_pta_ids: { type: ['array', 'null'], items: { type: 'integer' }, description: 'Contract 5.1: WTO Preferential Trade Arrangements Database ids.' },
    gptad_id: { type: ['integer', 'null'], description: 'Contract 5.1: World Bank GPTAD agreement id.' },
    dta_id: { type: ['integer', 'null'], description: 'Contract 5.1: World Bank Deep Trade Agreements id.' },
    unctad_iia_id: { type: ['integer', 'null'], description: 'Contract 5.1: UNCTAD IIA Navigator treaty id.' },
    unts_registration: { ...strOrNull, description: 'Contract 5.1: UN Treaty Series registration number.' },
    verification: strOrNull,
    _name: { ...str, description: "The record's name, or its intblock's name for a linked record without one." },
    _acronym: strOrNull,
    _party_count: { ...int, description: 'Parties with status party.' },
    _parties: { type: 'array', items: agreementParty },
    _countries: {
      type: 'array',
      description: 'Rows of the country_trade_agreements view for this agreement: current coverage, a bloc party expanded to its current members (via = bloc ID).',
      items: {
        type: 'object',
        required: ['code', 'via'],
        properties: { code: str, name: strOrNull, flag_emoji: strOrNull, via: strOrNull, role: roleProp, provisional_application: strOrNull, in_force: strOrNull },
        additionalProperties: false,
      },
    },
    _block: blockRef,
    _supersedes: { type: 'array', items: agreementRef, description: "Records this one replaced: its own supersedes and every record whose superseded_by names it." },
    _superseded_by: agreementRef,
    _parent: { ...agreementRef, description: 'Contract 5.1: the scheme named by parent.' },
    _children: { type: 'array', items: agreementRef, description: 'Contract 5.1: records whose parent is this one (sub-schemes).' },
    _instruments: {
      type: 'array',
      description: 'Contract 5.1: rows of trade_agreement_instruments for this agreement (protocols, supplements, early harvests, joint committee decisions).',
      items: {
        type: 'object',
        required: ['instrument_id'],
        properties: {
          instrument_id: str,
          kind: { ...strOrNull, description: 'amending_protocol, supplementary_agreement, early_harvest, joint_committee_decision, exchange_of_letters, other (open enum).' },
          name: strOrNull,
          status: { ...strOrNull, description: 'negotiating, signed, in_force, terminated, abandoned (open enum).' },
          signed: strOrNull,
          in_force: strOrNull,
          ended: strOrNull,
          coverage: { type: ['array', 'null'], items: { type: 'string' }, description: 'goods, services, investment (open enum).' },
          other_names: { type: ['array', 'null'] },
          notes: strOrNull,
          provenance: { type: ['array', 'null'] },
        },
        additionalProperties: false,
      },
    },
    _alias_notes: { type: 'array', items: aliasNote },
    _source_path: str,
  },
  additionalProperties: true,
};

const country: Schema = {
  type: 'object',
  required: ['code', 'name', 'iso3code', 'entity_type', 'code_status', '_current_member_count', '_memberships', '_similar', '_borders'],
  properties: {
    code: { type: 'string', pattern: '^[A-Z]{2}$', description: 'ISO 3166-1 alpha-2 (or user-assigned) code; primary key.' },
    iso3code: { type: 'string', pattern: '^[A-Z]{3}$' },
    name: str,
    entity_type: str,
    code_status: str,
    region: idValue,
    incomeLevel: idValue,
    borders: { type: 'array', items: { type: 'string', pattern: '^[A-Z]{3}$' }, description: 'Alpha-3 codes.' },
    _current_member_count: int,
    _status_counts: { type: 'object', additionalProperties: int },
    _blocktype_counts: { type: 'object', additionalProperties: int },
    _memberships: { type: 'array', items: membership },
    _similar: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'shared', 'jaccard'],
        properties: { code: str, name: strOrNull, shared: int, jaccard: { type: 'number', minimum: 0, maximum: 1 }, flag_emoji: strOrNull },
      },
    },
    _borders: {
      type: 'array',
      items: {
        type: 'object',
        required: ['iso3code', 'code', 'name', 'status', 'border_status'],
        properties: {
          iso3code: str,
          code: strOrNull,
          name: strOrNull,
          status: {
            ...strOrNull,
            description: 'Current crossing status from border_status (closed, restricted; open enum). Null when no closure is recorded, which does not mean the border is verified open. Most rows rest on official travel advice, which describes crossings for travellers: a closed border can still carry some freight.',
          },
          border_status: {
            type: ['object', 'null'],
            description: 'The border_status row of this pair, current or ended; null when there is none.',
            required: ['status', 'since', 'until', 'note', 'last_verified', 'provenance'],
            properties: { status: strOrNull, since: strOrNull, until: strOrNull, note: strOrNull, last_verified: strOrNull, provenance: { type: 'array' } },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    },
    _parent_exists: bool,
    _dependents: { type: 'array', items: { type: 'object', required: ['code', 'name'] } },
    _alias_notes: { type: 'array', items: aliasNote },
    _trade_agreements: { type: 'array', items: countryAgreement, description: 'Trade agreements the country is a current party to (country_trade_agreements view), whatever their status.' },
    _former_trade_agreements: { type: 'array', items: formerCountryAgreement },
    _source_path: str,
  },
  additionalProperties: true,
};

const block: Schema = {
  type: 'object',
  required: ['id', 'name', 'blocktype', 'status', '_active', '_current_member_count', '_roster'],
  properties: {
    id: { type: 'string', pattern: '^[A-Za-z0-9_+-]+$', description: 'Intblock ID; primary key, case-sensitive.' },
    name: str,
    blocktype: { type: 'array', items: str, minItems: 1 },
    status: str,
    includes: { type: 'array', description: 'Roster exactly as exported by internacia-db.' },
    institutional_design: {
      type: ['object', 'null'],
      description:
        'What the founding instrument lets the organization decide and enforce (contract 4.1): mandate, decision_rule, decision_force, independent_organs, enforcement, mutual_defence, veto_holders (alpha-2 codes). Open enums; an absent object or subfield means unknown.',
    },
    _acronym: strOrNull,
    _active: { type: 'boolean', description: 'False when status is historical or the entity is dissolved.' },
    _current_member_count: { ...int, description: 'Rows of current_memberships for this intblock (countries and territories).' },
    _status_counts: { type: 'object', additionalProperties: int },
    _roster: { type: 'array', items: rosterEntry },
    _parents: { type: 'array', items: blockRef },
    _children: { type: 'array', items: blockRef },
    _predecessor: blockRef,
    _successor: blockRef,
    _similar: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'shared', 'jaccard'],
        properties: { id: str, name: strOrNull, acronym: strOrNull, shared: int, jaccard: { type: 'number', minimum: 0, maximum: 1 } },
      },
    },
    _hq_country_name: strOrNull,
    _alias_notes: { type: 'array', items: aliasNote },
    _trade_agreement: {
      type: ['object', 'null'],
      description: 'The trade agreements registry record linked to this intblock (contract 5.0), if any.',
      required: ['agreement_id', 'status'],
      properties: { ...agreementRowProps, wto_rta_id: { type: ['integer', 'null'] } },
      additionalProperties: false,
    },
    _party_to_agreements: {
      type: 'array',
      description: 'Agreements this intblock is a party to as a bloc.',
      items: { type: 'object', required: ['agreement_id', 'name', 'status'], properties: { ...agreementRowProps, role: roleProp, party_status: strOrNull }, additionalProperties: false },
    },
    _source_path: str,
  },
  additionalProperties: true,
};

const doc = (name: string, title: string, properties: Schema, required: string[]): Schema => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: schemaUrl(name),
  title,
  type: 'object',
  required: ['meta', ...required],
  properties: { meta: { $ref: '#/$defs/meta' }, ...properties },
  $defs: { meta: metaDef },
});

const idList = { type: 'array', items: str };
const typeRecord: Schema = {
  type: 'object',
  required: ['id', 'name', '_count', '_blocks'],
  properties: {
    id: str,
    name: str,
    description: { ...strOrNull, description: 'Scope note: what the type covers and its boundary with overlapping types.' },
    deprecated: {
      type: ['object', 'null'],
      description: 'Set when internacia-db deprecates the type; it stays valid until the release named in removal.',
      properties: { replacements: { type: ['array', 'null'], items: str }, removal: strOrNull, note: strOrNull },
    },
    other_names: { type: 'array', items: { type: 'object', required: ['lang', 'name'] } },
    _count: int,
    _active_count: int,
    _primary_count: int,
    _blocks: { ...idList, description: 'IDs of the intblocks of this type, sorted by name.' },
    _founded_decades: { type: 'object', additionalProperties: int },
    _undated: int,
  },
  additionalProperties: false,
};
const topicRecord: Schema = {
  type: 'object',
  required: ['key', 'name', '_count', '_blocks'],
  properties: {
    key: str,
    name: str,
    _count: int,
    _active_count: int,
    _blocks: idList,
    _related: { type: 'array', items: { type: 'object', required: ['key', 'name', 'shared'], properties: { key: str, name: str, shared: int } } },
  },
  additionalProperties: false,
};
const areaRecord: Schema = {
  type: 'object',
  required: ['slug', 'kind', 'name', '_countries', '_blocks'],
  properties: {
    slug: str,
    kind: { enum: ['continent', 'subregion'] },
    name: str,
    _continent: strOrNull,
    _countries: { ...idList, description: 'Country codes, sorted by name.' },
    _iso_count: int,
    _blocks: { ...idList, description: 'Intblocks whose regions list this area.' },
  },
  additionalProperties: false,
};
const coverageRow = {
  type: 'object',
  required: ['field', 'filled', 'total', 'share', 'missing'],
  properties: { field: str, filled: int, total: int, share: { type: 'number', minimum: 0, maximum: 1 }, missing: idList, gate: { type: 'object' } },
};

export const SCHEMAS: Record<string, Schema> = {
  memberships: doc(
    'memberships',
    'Current membership edges',
    {
      format: { const: ['block_id', 'country_code', 'status', 'joined', 'role'] },
      count: int,
      data: { type: 'array', items: { type: 'array', prefixItems: [str, str, str, strOrNull, strOrNull], minItems: 5, maxItems: 5 } },
    },
    ['format', 'count', 'data'],
  ),
  headquarters: doc(
    'headquarters',
    'Intblock headquarters with coordinates',
    {
      count: int,
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'name', 'city', 'lat', 'lng', 'active'],
          properties: { id: str, name: str, acronym: strOrNull, city: str, country: strOrNull, country_name: strOrNull, lat: { type: 'number' }, lng: { type: 'number' }, active: bool },
          additionalProperties: false,
        },
      },
    },
    ['count', 'data'],
  ),
  'types-list': doc('types-list', 'All block types', { count: int, data: { type: 'array', items: typeRecord } }, ['count', 'data']),
  type: doc('type', 'One block type with its intblocks', { data: typeRecord }, ['data']),
  'topics-list': doc('topics-list', 'All topics', { count: int, data: { type: 'array', items: topicRecord } }, ['count', 'data']),
  topic: doc('topic', 'One topic with its intblocks', { data: topicRecord }, ['data']),
  'geography-list': doc('geography-list', 'Continents and subregions', { count: int, data: { type: 'array', items: areaRecord } }, ['count', 'data']),
  area: doc('area', 'One continent or subregion', { data: areaRecord }, ['data']),
  stats: doc(
    'stats',
    'Field coverage and record counts',
    {
      counts: { type: 'object' },
      data: {
        type: 'object',
        required: ['countries', 'intblocks', 'memberships'],
        properties: {
          countries: { type: 'object', required: ['completeness'], properties: { completeness: { type: 'array', items: coverageRow } } },
          intblocks: { type: 'object', required: ['completeness'], properties: { completeness: { type: 'array', items: coverageRow } } },
          memberships: { type: 'object' },
        },
      },
    },
    ['counts', 'data'],
  ),
  index: doc('index', 'API index', { counts: { type: 'object' }, endpoints: { type: 'object', additionalProperties: str }, notes: { type: 'array', items: str }, llms_txt: url }, ['counts', 'endpoints']),
  'countries-list': doc(
    'countries-list',
    'All countries (lite)',
    {
      count: int,
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['code', 'iso3code', 'name', 'entity_type', 'code_status', '_current_member_count', '_html', '_json'],
          properties: { code: str, iso3code: str, name: str, flag_emoji: strOrNull, continents: { type: 'array', items: str }, subregion: strOrNull, entity_type: str, code_status: str, un_status: strOrNull, population: { ...indicator, description: 'Population: value, year (null when unknown) and source.' }, area: { ...indicator, description: 'Land area in km²: value, year (null when unknown) and source.' }, _current_member_count: int, _html: url, _json: url },
          additionalProperties: false,
        },
      },
    },
    ['count', 'data'],
  ),
  country: doc('country', 'One country with its memberships', { data: country }, ['data']),
  'blocks-list': doc(
    'blocks-list',
    'All intblocks (lite)',
    {
      count: int,
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'name', 'blocktype', 'status', '_active', '_current_member_count', '_json'],
          properties: { id: str, name: str, _acronym: strOrNull, blocktype: { type: 'array', items: str }, status: str, scope_category: strOrNull, geographic_scope: strOrNull, founded: strOrNull, headquarters_country: strOrNull, _active: bool, _current_member_count: int, _json: url },
          additionalProperties: false,
        },
      },
    },
    ['count', 'data'],
  ),
  block: doc('block', 'One intblock with its resolved roster', { data: block }, ['data']),
  'agreements-list': doc(
    'agreements-list',
    'All trade agreements (lite)',
    {
      count: int,
      data: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', '_name', 'agreement_type', 'status', 'verification', '_party_count', '_json'],
          properties: {
            id: str,
            _name: str,
            _acronym: strOrNull,
            agreement_type: strOrNull,
            status: strOrNull,
            signed: strOrNull,
            provisional_application: strOrNull,
            in_force: strOrNull,
            ended: strOrNull,
            intblock_id: strOrNull,
            parent: strOrNull,
            wto_rta_id: { type: ['integer', 'null'] },
            aric_id: { type: ['integer', 'null'] },
            verification: strOrNull,
            _party_count: int,
            _json: url,
          },
          additionalProperties: false,
        },
      },
    },
    ['count', 'data'],
  ),
  agreement: doc('agreement', 'One trade agreement with its parties', { data: agreement }, ['data']),
  aliases: doc('aliases', 'Retired and renamed IDs', { intblocks: { type: 'array' }, countries: { type: 'array' } }, ['intblocks', 'countries']),
  'alias-document': doc(
    'alias-document',
    'Document at a retired or renamed ID',
    {
      redirect: { type: ['string', 'null'], format: 'uri' },
      candidate: { type: ['string', 'null'], format: 'uri' },
      kind: { enum: ['redirect', 'disambiguation', 'retired'] },
      target_dataset: { ...strOrNull, description: 'trade_agreements when the ID moved to the trade agreements registry (contract 5.0); redirect then names an agreement document.' },
      reason: str,
      since: str,
      note: strOrNull,
    },
    ['redirect', 'kind', 'reason', 'since'],
  ),
  'search-index': doc(
    'search-index',
    'Entity finder index',
    {
      format: { const: ['kind', 'id', 'label', 'path', 'active', 'names'] },
      data: {
        type: 'array',
        items: {
          type: 'array',
          prefixItems: [{ enum: ['c', 'b', 'a'], description: 'c country, b intblock, a trade agreement.' }, str, str, str, { enum: [0, 1] }, { type: 'array', items: { type: 'array', prefixItems: [str, str], minItems: 2, maxItems: 2 } }],
          minItems: 6,
          maxItems: 6,
        },
      },
    },
    ['format', 'data'],
  ),
};

export function openapi(): Schema {
  const ok = (schema: string, description: string) => ({
    '200': { description, content: { 'application/json': { schema: { $ref: schemaUrl(schema) } } } },
  });
  const code = { name: 'CODE', in: 'path', required: true, description: 'Country code, uppercase, as in the data (e.g. FR, XK).', schema: { type: 'string', pattern: '^[A-Z]{2}$' } };
  const id = { name: 'ID', in: 'path', required: true, description: 'Exact intblock ID, case-sensitive (e.g. EU, G-20, AfCFTA).', schema: { type: 'string' } };
  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'Internacia static API',
      version: meta.data.version,
      summary: 'Countries, international organizations, country groupings and trade agreements from internacia-db, as static JSON.',
      description:
        'Read-only JSON files built from internacia-db. No authentication, no rate limit, no query parameters: every resource is a file. Fields starting with an underscore are derived by the site; all other fields are internacia-db export fields. Retired IDs return an alias document instead of an entity; the two-party trade agreements that left intblocks in v5.0.0 return an alias document that redirects to their agreement document.',
      license: { name: 'CC-BY-4.0 (data); country centroids ODbL-1.0', identifier: 'CC-BY-4.0' },
      contact: { url: 'https://github.com/datenoio/internacia-web' },
    },
    servers: [{ url: absolute(path('api/v1')) }],
    externalDocs: { description: 'Guide for AI agents', url: absolute(path('llms.txt')) },
    paths: {
      '/index.json': { get: { operationId: 'getIndex', summary: 'Entry points and counts', responses: ok('index', 'API index') } },
      '/countries.json': { get: { operationId: 'listCountries', summary: 'All countries and territories (lite)', responses: ok('countries-list', 'Lite list of countries') } },
      '/countries/{CODE}.json': {
        get: {
          operationId: 'getCountry',
          summary: 'One country with memberships, borders and similar countries',
          parameters: [code],
          responses: { ...ok('country', 'Country document, or an alias document for a retired code'), '404': { description: 'Unknown code' } },
        },
      },
      '/blocks.json': { get: { operationId: 'listBlocks', summary: 'All intblocks (lite)', responses: ok('blocks-list', 'Lite list of intblocks') } },
      '/blocks/{ID}.json': {
        get: {
          operationId: 'getBlock',
          summary: 'One intblock with its resolved roster and structure',
          parameters: [id],
          responses: { ...ok('block', 'Intblock document, or an alias document for a retired ID'), '404': { description: 'Unknown ID' } },
        },
      },
      '/agreements.json': { get: { operationId: 'listAgreements', summary: 'All trade agreements of the registry (lite)', responses: ok('agreements-list', 'Lite list of trade agreements') } },
      '/agreements/{ID}.json': {
        get: {
          operationId: 'getAgreement',
          summary: 'One trade agreement with its parties and the countries it covers',
          parameters: [{ ...id, description: 'Exact registry ID, case-sensitive (e.g. USKR, RCEP, EFTASG).' }],
          responses: { ...ok('agreement', 'Trade agreement document'), '404': { description: 'Unknown ID' } },
        },
      },
      '/aliases.json': { get: { operationId: 'listAliases', summary: 'Retired and renamed IDs', responses: ok('aliases', 'Alias lists') } },
      '/types.json': { get: { operationId: 'listTypes', summary: 'All block types with their intblock IDs', responses: ok('types-list', 'Block types') } },
      '/types/{KEY}.json': { get: { operationId: 'getType', summary: 'One block type', parameters: [{ name: 'KEY', in: 'path', required: true, schema: { type: 'string' } }], responses: ok('type', 'Block type') } },
      '/topics.json': { get: { operationId: 'listTopics', summary: 'All topics with their intblock IDs', responses: ok('topics-list', 'Topics') } },
      '/topics/{KEY}.json': { get: { operationId: 'getTopic', summary: 'One topic', parameters: [{ name: 'KEY', in: 'path', required: true, schema: { type: 'string' } }], responses: ok('topic', 'Topic') } },
      '/geography.json': { get: { operationId: 'listAreas', summary: 'Continents and subregions', responses: ok('geography-list', 'Areas') } },
      '/geography/{SLUG}.json': { get: { operationId: 'getArea', summary: 'One continent or subregion', parameters: [{ name: 'SLUG', in: 'path', required: true, schema: { type: 'string' } }], responses: ok('area', 'Area') } },
      '/memberships.json': { get: { operationId: 'listMemberships', summary: 'Every current membership edge of a country or territory', responses: ok('memberships', 'Membership edges') } },
      '/headquarters.json': { get: { operationId: 'listHeadquarters', summary: 'Intblock headquarters with coordinates', responses: ok('headquarters', 'Headquarters') } },
      '/stats.json': { get: { operationId: 'getStats', summary: 'Field coverage, with the IDs of records missing each field', responses: ok('stats', 'Statistics') } },
      '/search-index.json': { get: { operationId: 'getSearchIndex', summary: 'Names, acronyms and codes in all languages', responses: ok('search-index', 'Finder index') } },
    },
  };
}
