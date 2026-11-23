// Trade agreements registry (contract 5.0): wording and facts shared by the HTML cards and their
// Markdown twins, so both say the same. The registry is reference data: parties, status, dates
// and catalogue IDs. It has no trade values, tariff lines or depth scores, and the site adds none.
import type { Agreement, AgreementRow, Provenance } from './data';
import { enumLabel } from './format';

export const REGISTRY_SCOPE_NOTE =
  'The registry records parties, status, dates and catalogue IDs only: no trade values, tariff lines, preference margins or depth scores.';

// internacia-db docs/ai-consumers.md: catalogue statuses lag, and ARIC lists only ADB-member
// parties. Contract 5.1 adds the catalogues of preference schemes, investment treaties and trade
// relations agreements (the `verification` description of trade_agreements.schema.json).
export const CATALOGUE_SOURCES =
  'WTO RTA-IS, the WTO PTA Database, ADB ARIC, GPTAD, the UNCTAD IIA Navigator, EDIT or the UN Treaty Series';
export const CATALOGUE_NOTE = `This record comes from a catalogue (${CATALOGUE_SOURCES}) and was not checked against the treaty text, a depositary or a party government. Catalogue statuses can lag, and ADB ARIC lists only parties that are ADB members: check the sources before relying on a date.`;

// Contract 5.1: in_force is the definitive entry into force, provisional_application the date the
// agreement began to apply provisionally; an agreement applied only provisionally has no in_force.
export const PROVISIONAL_NOTE =
  'In force is the definitive entry into force; provisional application is the date from which the agreement applied provisionally, before or without it. Catalogue records may give a provisional date as the entry into force.';

// The country_trade_agreements view expands a bloc party to its current members.
export const COVERAGE_NOTE =
  'Countries covered are current: a bloc that is a party (such as the European Union) counts its current members, so a former member of the bloc is not listed.';

export const PREFERENCE_SCHEME_NOTE =
  'A non-reciprocal preference scheme lists the grantors and the beneficiaries as parties. Two grantors of the same scheme are not trading partners under it.';

export const COUNTRY_AGREEMENTS_NOTE =
  'Agreements this country is a current party to, directly or through a bloc that is a party (the "via" column), whatever the agreement\'s own status. The list follows the registry\'s current coverage, not history. Investment treaties and trade relations agreements grant no trade preferences, and a preference scheme is not reciprocal: count them apart from trade agreements.';

export const INSTRUMENTS_NOTE =
  'Protocols, supplements, early harvest arrangements and joint committee decisions that amend or add to the agreement among its parties. They do not change the agreement\'s own status or dates.';

// Statuses in the order cards list them; an unknown status (open enum) comes last. `suspended`
// (contract 5.1): negotiations launched and then put on hold, not formally ended.
export const AGREEMENT_STATUS_ORDER = ['in_force', 'signed', 'negotiating', 'suspended', 'proposed', 'terminated', 'superseded', 'abandoned'];

// What a country's (or bloc's) row is to it (internacia-db docs/ai-consumers.md): a preference
// scheme it grants or benefits from (`role`), an investment treaty or a trade relations agreement
// (no preferences: left out of trade agreement counts), or else a trade agreement.
export const AGREEMENT_KINDS = ['trade', 'investment', 'trade_relations', 'beneficiary', 'grantor'] as const;
export type AgreementKind = (typeof AGREEMENT_KINDS)[number];
export const agreementKind = (r: { agreement_type: string | null; role?: string | null }): AgreementKind =>
  r.role === 'beneficiary' || r.role === 'grantor'
    ? r.role
    : r.agreement_type === 'investment'
      ? 'investment'
      : r.agreement_type === 'trade_relations'
        ? 'trade_relations'
        : 'trade';
export const AGREEMENT_KIND_LABELS: Record<AgreementKind, string> = {
  trade: 'Trade agreements',
  investment: 'Investment treaties',
  trade_relations: 'Trade relations agreements',
  beneficiary: 'Preference schemes as beneficiary',
  grantor: 'Preference schemes as grantor',
};
// The kinds in a sentence: "12 trade agreements, 3 investment treaties and 1 preference scheme as
// beneficiary"; kinds without rows are left out.
const KIND_PHRASES: Record<AgreementKind, [string, string]> = {
  trade: ['trade agreement', 'trade agreements'],
  investment: ['investment treaty', 'investment treaties'],
  trade_relations: ['trade relations agreement', 'trade relations agreements'],
  beneficiary: ['preference scheme as beneficiary', 'preference schemes as beneficiary'],
  grantor: ['preference scheme as grantor', 'preference schemes as grantor'],
};
export function kindSummary(rows: { agreement_type: string | null; role?: string | null }[], num: (n: number) => string): string {
  const counts = new Map<AgreementKind, number>();
  for (const r of rows) counts.set(agreementKind(r), (counts.get(agreementKind(r)) ?? 0) + 1);
  const parts = AGREEMENT_KINDS.filter((k) => counts.has(k)).map((k) => {
    const n = counts.get(k)!;
    return `${num(n)} ${KIND_PHRASES[k][n === 1 ? 0 : 1]}`;
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : (parts[0] ?? '');
}

export const partyRoleLabel = (role: string | null | undefined): string => enumLabel('party_role', role);
// A role worth showing: grantor or beneficiary. `party` (every reciprocal agreement) is not.
export const showsRole = (role: string | null | undefined): boolean => Boolean(role) && role !== 'party';

export const agreementStatusLabel = (status: string | null | undefined): string => enumLabel('agreement_status', status);
export const agreementTypeLabel = (type: string | null | undefined): string => enumLabel('agreement_type', type);

// An agreement that no longer applies or never did: terminated, superseded or abandoned.
// `suspended` negotiations are on hold, not ended.
export const agreementEnded = (status: string | null | undefined): boolean =>
  status === 'terminated' || status === 'superseded' || status === 'abandoned';

export const agreementTitle = (a: { _name: string; _acronym: string | null }): string =>
  a._acronym ? `${a._name} (${a._acronym})` : a._name;

export const rowTitle = (r: AgreementRow): string => (r.acronym ? `${r.name} (${r.acronym})` : r.name);

export const wtoRtaUrl = (id: number): string => `https://rtais.wto.org/UI/PublicShowRTAIDCard.aspx?rtaid=${id}`;
export const aricUrl = (id: number): string => `https://aric.adb.org/fta.php?id=${id}`;

// Catalogue IDs of contract 5.1, shown as codes: the records link the catalogue pages themselves
// (`links`), so the site builds no URL from them.
export function catalogueIds(a: Agreement): [string, string | undefined][] {
  return [
    ['WTO PTA Database ID', a.wto_pta_ids?.length ? a.wto_pta_ids.join(', ') : undefined],
    ['GPTAD ID', a.gptad_id != null ? String(a.gptad_id) : undefined],
    ['World Bank DTA ID', a.dta_id != null ? String(a.dta_id) : undefined],
    ['UNCTAD IIA Navigator ID', a.unctad_iia_id != null ? String(a.unctad_iia_id) : undefined],
    ['UN Treaty Series registration', a.unts_registration ?? undefined],
  ];
}

// Key facts of an agreement card, in order; empty values are left out by the caller.
export function agreementFacts(a: Agreement): [string, string | number | null | undefined][] {
  return [
    ['ID', a.id],
    ['Type', agreementTypeLabel(a.agreement_type)],
    ['Status', agreementStatusLabel(a.status)],
    ['Signed', a.signed],
    ['Provisional application', a.provisional_application],
    ['In force', a.in_force],
    ['Ended', a.ended],
    ['Parties', a._party_count],
    ['WTO RTA ID', a.wto_rta_id],
    ['ADB ARIC ID', a.aric_id],
    ...catalogueIds(a),
    ['Wikidata', a.wikidata_id],
    ['Verification', enumLabel('verification', a.verification)],
    ['Last verified', a.last_verified],
  ];
}

export const instrumentKindLabel = (kind: string | null | undefined): string => enumLabel('instrument_kind', kind);
export const instrumentStatusLabel = (status: string | null | undefined): string => enumLabel('instrument_status', status);
export const coverageLabel = (coverage: string[] | null | undefined): string =>
  (coverage ?? []).map((c) => enumLabel('instrument_coverage', c)).join(', ');

// Provenance rows grouped by source: a registry record cites one source for several fields (a
// catalogue record gives parties, status and dates from one page), so a card lists each source
// once with its fields. The JSON twin keeps the rows as they are.
export interface ProvenanceGroup {
  source: string | null;
  url: string | null;
  retrieved_at: string | null;
  license: string | null;
  fields: string[];
}
export function provenanceGroups(rows: Provenance[] | null | undefined): ProvenanceGroup[] {
  const out = new Map<string, ProvenanceGroup>();
  for (const p of rows ?? []) {
    const key = JSON.stringify([p.source ?? null, p.url ?? null, p.retrieved_at ?? null, p.license ?? null]);
    const g = out.get(key) ?? { source: p.source ?? null, url: p.url ?? null, retrieved_at: p.retrieved_at ?? null, license: p.license ?? null, fields: [] };
    if (p.field && !g.fields.includes(p.field)) g.fields.push(p.field);
    out.set(key, g);
  }
  return [...out.values()];
}

export const groupCounts = <T,>(rows: T[], key: (r: T) => string | null | undefined): [string, number][] => {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? '';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()];
};

// Position of a status in AGREEMENT_STATUS_ORDER; an unknown or missing status comes last.
export const agreementStatusRank = (status: string | null | undefined): number => {
  const i = AGREEMENT_STATUS_ORDER.indexOf(status ?? '');
  return i < 0 ? AGREEMENT_STATUS_ORDER.length : i;
};

export const byStatusOrder = (a: string, b: string): number => agreementStatusRank(a) - agreementStatusRank(b) || a.localeCompare(b);

// Status badge classes, the same on the card and in the index: in force is filled, an agreement
// that no longer applies or never did is marked, the stages before entry into force are plain.
export const agreementStatusBadge = (status: string | null | undefined): string =>
  status === 'in_force' ? 'badge badge-status' : agreementEnded(status) ? 'badge badge-warn' : 'badge';

// Facet values of a row of the trade agreements index (/agreements/). The page counts them for its
// default view and /agreements/facets.json carries them for the filters (scripts/tables.ts,
// data-rows), so the counts and the filters use the same values. The rows carry none of them: with
// v5.1.0 (5,195 rows) they were an eighth of the page's gzip bytes, and Lighthouse's simulated 4G
// waits for the whole document before the first paint.
export const NO_VALUE = '_none';
export const AGREEMENT_FACETS = ['countries', 'status', 'type', 'parties', 'verification'] as const;
export type AgreementFacet = (typeof AGREEMENT_FACETS)[number];
export const PARTIES_LABELS: Record<string, string> = { two: 'Two', 'three-plus': 'Three or more', one: 'One', none: 'None recorded' };
const partiesBucket = (n: number): string => (n >= 3 ? 'three-plus' : n === 2 ? 'two' : n === 1 ? 'one' : 'none');
// Countries covered: the country_trade_agreements view's rows for the agreement (current coverage,
// a bloc party expanded to its current members), the same as the card's "Countries covered".
export function agreementFacetValues(a: Agreement): Record<AgreementFacet, string[]> {
  return {
    countries: [...new Set(a._countries.map((c) => c.code))].sort(),
    status: [a.status ?? NO_VALUE],
    type: [a.agreement_type ?? NO_VALUE],
    parties: [partiesBucket(a._party_count)],
    verification: [a.verification ?? NO_VALUE],
  };
}
