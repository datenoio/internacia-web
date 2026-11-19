// Small helpers for chart series.

// Decade buckets from `{ "1940": 3, ... }`, with empty decades between first and last filled in.
export function decadeSeries(counts: Record<string, number>): { label: string; value: number }[] {
  const keys = Object.keys(counts).map(Number).filter((n) => Number.isFinite(n));
  if (!keys.length) return [];
  const out = [];
  for (let d = Math.min(...keys); d <= Math.max(...keys); d += 10) out.push({ label: `${d}s`, value: counts[String(d)] ?? 0 });
  return out;
}

// Fixed bins for memberships per country on the home map (SPEC §8, V2).
export const MEMBERSHIP_BINS = [
  { cls: 's1', min: 1, max: 99, label: '1–99' },
  { cls: 's2', min: 100, max: 199, label: '100–199' },
  { cls: 's3', min: 200, max: 299, label: '200–299' },
  { cls: 's4', min: 300, max: 399, label: '300–399' },
  { cls: 's5', min: 400, max: Infinity, label: '400 or more' },
];

export const binFor = (n: number) => MEMBERSHIP_BINS.find((b) => n >= b.min && n <= b.max);
