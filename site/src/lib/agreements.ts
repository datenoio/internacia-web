// Trade agreements registry (contract 5.0): wording and facts shared by the HTML cards and their
// Markdown twins, so both say the same. The registry is reference data: parties, status, dates
// and catalogue IDs. It has no trade values, tariff lines or depth scores, and the site adds none.
import type { Agreement, AgreementRow } from './data';
import { enumLabel } from './format';

export const REGISTRY_SCOPE_NOTE =
  'The registry records parties, status, dates and catalogue IDs only: no trade values, tariff lines, preference margins or depth scores.';

// internacia-db docs/ai-consumers.md: ARIC lists only ADB-member parties and its statuses lag.
export const CATALOGUE_NOTE =
  'This record comes from a catalogue (WTO RTA-IS or ADB ARIC) and was not checked against the treaty text or a depositary. Catalogue statuses can lag, and ADB ARIC lists only parties that are ADB members: check the sources before relying on a date.';

// The country_trade_agreements view expands a bloc party to its current members.
export const COVERAGE_NOTE =
  'Countries covered are current: a bloc that is a party (such as the European Union) counts its current members, so a former member of the bloc is not listed.';

export const PREFERENCE_SCHEME_NOTE =
  'A non-reciprocal preference scheme lists the grantors and the beneficiaries as parties. Two grantors of the same scheme are not trading partners under it.';

export const COUNTRY_AGREEMENTS_NOTE =
  'Agreements this country is a current party to, directly or through a bloc that is a party (the "via" column), whatever the agreement\'s own status. The list follows the registry\'s current coverage, not history.';

// Statuses in the order cards list them; an unknown status (open enum) comes last.
export const AGREEMENT_STATUS_ORDER = ['in_force', 'signed', 'negotiating', 'proposed', 'terminated', 'superseded', 'abandoned'];

export const agreementStatusLabel = (status: string | null | undefined): string => enumLabel('agreement_status', status);
export const agreementTypeLabel = (type: string | null | undefined): string => enumLabel('agreement_type', type);

// An agreement that no longer applies or never did: terminated, superseded or abandoned.
export const agreementEnded = (status: string | null | undefined): boolean =>
  status === 'terminated' || status === 'superseded' || status === 'abandoned';

export const agreementTitle = (a: { _name: string; _acronym: string | null }): string =>
  a._acronym ? `${a._name} (${a._acronym})` : a._name;

export const rowTitle = (r: AgreementRow): string => (r.acronym ? `${r.name} (${r.acronym})` : r.name);

export const wtoRtaUrl = (id: number): string => `https://rtais.wto.org/UI/PublicShowRTAIDCard.aspx?rtaid=${id}`;
export const aricUrl = (id: number): string => `https://aric.adb.org/fta.php?id=${id}`;

// Key facts of an agreement card, in order; empty values are left out by the caller.
export function agreementFacts(a: Agreement): [string, string | number | null | undefined][] {
  return [
    ['ID', a.id],
    ['Type', agreementTypeLabel(a.agreement_type)],
    ['Status', agreementStatusLabel(a.status)],
    ['Signed', a.signed],
    ['In force', a.in_force],
    ['Ended', a.ended],
    ['Parties', a._party_count],
    ['WTO RTA ID', a.wto_rta_id],
    ['ADB ARIC ID', a.aric_id],
    ['Wikidata', a.wikidata_id],
    ['Verification', enumLabel('verification', a.verification)],
    ['Last verified', a.last_verified],
  ];
}

export const groupCounts = <T,>(rows: T[], key: (r: T) => string | null | undefined): [string, number][] => {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) ?? '';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()];
};

export const byStatusOrder = (a: string, b: string): number => {
  const rank = (s: string) => (AGREEMENT_STATUS_ORDER.includes(s) ? AGREEMENT_STATUS_ORDER.indexOf(s) : AGREEMENT_STATUS_ORDER.length);
  return rank(a) - rank(b) || a.localeCompare(b);
};
