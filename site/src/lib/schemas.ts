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
    section: { enum: ['blocks', 'countries'] },
    kind: { enum: ['reused', 'former_id', 'redirect', 'disambiguation', 'retired'] },
  },
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
      items: { type: 'object', required: ['iso3code', 'code', 'name'], properties: { iso3code: str, code: strOrNull, name: strOrNull } },
    },
    _parent_exists: bool,
    _dependents: { type: 'array', items: { type: 'object', required: ['code', 'name'] } },
    _alias_notes: { type: 'array', items: aliasNote },
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
      format: { const: ['block_id', 'country_code', 'status', 'joined'] },
      count: int,
      data: { type: 'array', items: { type: 'array', prefixItems: [str, str, str, strOrNull], minItems: 4, maxItems: 4 } },
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
          properties: { code: str, iso3code: str, name: str, flag_emoji: strOrNull, continents: { type: 'array', items: str }, subregion: strOrNull, entity_type: str, code_status: str, un_status: strOrNull, _current_member_count: int, _html: url, _json: url },
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
  aliases: doc('aliases', 'Retired and renamed IDs', { intblocks: { type: 'array' }, countries: { type: 'array' } }, ['intblocks', 'countries']),
  'alias-document': doc(
    'alias-document',
    'Document at a retired or renamed ID',
    {
      redirect: { type: ['string', 'null'], format: 'uri' },
      candidate: { type: ['string', 'null'], format: 'uri' },
      kind: { enum: ['redirect', 'disambiguation', 'retired'] },
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
          prefixItems: [{ enum: ['c', 'b'] }, str, str, str, { enum: [0, 1] }, { type: 'array', items: { type: 'array', prefixItems: [str, str], minItems: 2, maxItems: 2 } }],
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
      summary: 'Countries, international organizations and country groupings from internacia-db, as static JSON.',
      description:
        'Read-only JSON files built from internacia-db. No authentication, no rate limit, no query parameters: every resource is a file. Fields starting with an underscore are derived by the site; all other fields are internacia-db export fields. Retired IDs return an alias document instead of an entity.',
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
