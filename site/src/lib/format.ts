// Display helpers: labels from internacia-db vocabularies, numbers and dates.
import { blocktypeById, labels } from './data';

const numberFormat = new Intl.NumberFormat('en');

export const num = (value: number | null | undefined): string =>
  value === null || value === undefined ? '' : numberFormat.format(value);

export const humanize = (key: string | null | undefined): string =>
  key ? key.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '';

// Open enums (SPEC §4.4): an unknown value falls back to its raw key, never breaks the build.
export const statusLabel = (status: string): string => labels().statuses[status]?.name ?? status;
export const statusDescription = (status: string): string => labels().statuses[status]?.description ?? '';
export const statusDeprecated = (status: string): boolean => labels().statuses[status]?.deprecated ?? false;

export const blocktypeLabel = (id: string): string => blocktypeById().get(id)?.name ?? humanize(id);
// Deprecated block types (contract 4.1, `intorg`) stay valid until the next MAJOR.
export const blocktypeDeprecated = (id: string): boolean => Boolean(blocktypeById().get(id)?.deprecated);

// Route roles (contract 4.1, includes[].role) from include_roles.yaml; open enum.
export const roleLabel = (role: string | null | undefined): string =>
  role ? (labels().include_roles?.[role]?.name ?? humanize(role)) : '';
export const roleDescription = (role: string | null | undefined): string =>
  role ? (labels().include_roles?.[role]?.description ?? '') : '';

// Institutional design (contract 4.1) from institutional_design.yaml: subfields in the catalog's
// order, values with their labels. Open enums: an unknown value shows as its humanized key.
export const designFields = (): string[] => Object.keys(labels().institutional_design ?? {});
export const designFieldLabel = (field: string): string => labels().institutional_design?.[field]?.name ?? humanize(field);
export const designFieldDescription = (field: string): string => labels().institutional_design?.[field]?.description ?? '';
export const designValueLabel = (field: string, value: string): string =>
  labels().institutional_design?.[field]?.values[value]?.name ?? humanize(value);
export const designValueDescription = (field: string, value: string): string =>
  labels().institutional_design?.[field]?.values[value]?.description ?? '';
export const topicLabel = (key: string, fallback?: string): string => labels().topics[key] ?? fallback ?? humanize(key);
export const vocabLabel = (vocab: string, id: string | number): string =>
  labels().vocabs[vocab]?.[String(id)] ?? humanize(String(id));

// Native names (contract 4): keys are the entity's own languages, ISO 639-1 or else 639-3, named in
// internacia-db's language_codes.yaml. Entries with neither name are left out.
export const nativeLanguageLabel = (key: string): string => labels().native_name_languages?.[key] ?? key;
export const nativeNameList = (
  names: Record<string, { official?: string | null; common?: string | null }> | undefined,
): { lang: string; language: string; names: string[] }[] =>
  Object.entries(names ?? {})
    .map(([lang, n]) => ({
      lang,
      language: nativeLanguageLabel(lang),
      names: [n.official, n.common].filter((v, i, a): v is string => Boolean(v) && a.indexOf(v) === i),
    }))
    .filter((n) => n.names.length > 0);

const ENUM_LABELS: Record<string, Record<string, string>> = {
  entity_type: {
    sovereign_state: 'Sovereign state',
    dependent_territory: 'Dependent territory',
    special_administrative_region: 'Special administrative region',
    disputed_territory: 'Disputed territory',
    historical_entity: 'Historical entity',
    supranational_grouping: 'Supranational grouping',
    statistical_area: 'Statistical area',
  },
  code_status: {
    official_iso3166_1: 'ISO 3166-1',
    user_assigned: 'User-assigned code',
    obsolete: 'Obsolete code',
    exceptionally_reserved: 'Exceptionally reserved code',
  },
  un_status: { member: 'UN member', observer: 'UN observer state', non_member: 'Not a UN member' },
  status: { formal: 'Formal', informal: 'Informal', 'de-facto': 'De facto', historical: 'Historical' },
  scope_category: {
    igo: 'Intergovernmental organization',
    treaty_body: 'Treaty body',
    policy_forum: 'Policy forum',
    reference_enumeration: 'Reference grouping',
    intergovernmental_body: 'Intergovernmental body',
    non_state_organization: 'Non-state organization',
  },
  geographic_scope: { global: 'Global', regional: 'Regional', 'sub-regional': 'Sub-regional', bilateral: 'Bilateral' },
  border_status: { closed: 'Closed', restricted: 'Restricted' },
  include_type: {
    country: 'Country',
    territory: 'Territory',
    organization: 'Organization',
    'historical-country': 'Historical country',
  },
};

export const enumLabel = (field: string, value: string | null | undefined): string =>
  value ? (ENUM_LABELS[field]?.[value] ?? humanize(value)) : '';

export const yesNo = (value: boolean | undefined): string => (value === undefined ? '' : value ? 'Yes' : 'No');

export function bytes(value: number | null): string {
  if (value === null || value === undefined) return '';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = value / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export const displayName = (name: string, acronym: string | null | undefined): string =>
  acronym ? `${name} (${acronym})` : name;

// Split text on `code` spans so IDs inside notes can become links.
export function splitCode(text: string): { text: string; code: boolean }[] {
  return text.split(/(`[^`]+`)/).filter(Boolean).map((part) =>
    part.startsWith('`') && part.endsWith('`') ? { text: part.slice(1, -1), code: true } : { text: part, code: false },
  );
}
