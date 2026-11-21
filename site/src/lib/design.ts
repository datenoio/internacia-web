// Contract 4.1 facts shared by the HTML cards and their Markdown twins, so both say the same:
// institutional design of an intblock, route roles in rosters, land-border crossing status.
import { countryByCode, type Block, type BorderStatus, type InstitutionalDesign } from './data';
import { designFieldDescription, designFieldLabel, designFields, designValueDescription, designValueLabel, enumLabel } from './format';

export interface DesignValue {
  key: string;
  label: string;
  description: string;
  // Veto holders are country alpha-2 codes; `exists` says whether the code has a country card.
  country?: { code: string; name: string | null; exists: boolean };
}

export interface DesignRow {
  field: string;
  label: string;
  description: string;
  values: DesignValue[];
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]);

// Subfields in the catalog's order, then any subfield the catalog does not know (open contract).
// An absent subfield means unknown and is left out; `none` is a value and is shown.
export function designRows(design: InstitutionalDesign | null | undefined): DesignRow[] {
  if (!design) return [];
  const known = designFields();
  const fields = [...known, ...Object.keys(design).filter((k) => !known.includes(k))];
  const rows: DesignRow[] = [];
  for (const field of fields) {
    const raw = (design as Record<string, unknown>)[field];
    const items = asList(raw);
    if (!items.length) continue;
    const values = items.map((item): DesignValue => {
      if (typeof item === 'boolean') return { key: String(item), label: item ? 'Yes' : 'No', description: '' };
      const key = String(item);
      if (field === 'veto_holders') {
        const c = countryByCode().get(key);
        return { key, label: c?.name ?? key, description: '', country: { code: key, name: c?.name ?? null, exists: Boolean(c) } };
      }
      return { key, label: designValueLabel(field, key), description: designValueDescription(field, key) };
    });
    rows.push({ field, label: designFieldLabel(field), description: designFieldDescription(field), values });
  }
  return rows;
}

export const hasDesign = (b: Block): boolean => designRows(b.institutional_design).length > 0;

// Evidence limit of border_status (internacia-db v4.2.0, docs/ai-consumers.md): shown under the
// border notes of the card and its Markdown twin, and checked in both by check_site.py.
export const BORDER_EVIDENCE_NOTE =
  'Most entries rest on official travel advice, which describes crossings for travellers: a border marked closed can still carry some freight.';

// "Closed since 1994", "Restricted", "Closed until 2001": the period as the data gives it.
export function borderStatusText(s: BorderStatus): string {
  const label = enumLabel('border_status', s.status);
  if (s.until) return `${label} ${s.since ? `${s.since}–${s.until}` : `until ${s.until}`}`;
  return s.since ? `${label} since ${s.since}` : label;
}
