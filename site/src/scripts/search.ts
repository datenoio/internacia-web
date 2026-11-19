// Entity finder over /api/v1/search-index.json (SPEC §6.12). Loaded on first use.
// Matches names in every language, acronyms and codes; ranks exact matches first.

export interface Hit {
  kind: 'c' | 'b';
  id: string;
  label: string;
  path: string;
  active: boolean;
  matched: string;
  lang: string;
  score: number;
}

type Row = [string, string, string, string, number, [string, string][]];
interface Entry {
  kind: 'c' | 'b';
  id: string;
  label: string;
  path: string;
  active: boolean;
  names: { text: string; lang: string; norm: string; words: string[] }[];
}

export const normalize = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

let index: Promise<Entry[]> | null = null;

export function loadIndex(url: string): Promise<Entry[]> {
  index ??= fetch(url)
    .then((r) => r.json())
    .then((doc: { data: Row[] }) =>
      doc.data.map(([kind, id, label, path, active, names]) => ({
        kind: kind as 'c' | 'b',
        id,
        label,
        path,
        active: active === 1,
        names: names.map(([text, lang]) => {
          const norm = normalize(text);
          return { text, lang, norm, words: norm.split(' ') };
        }),
      })),
    );
  return index;
}

function scoreName(q: string, qCompact: string, name: Entry['names'][number], isCode: boolean): number {
  if (!name.norm) return 0;
  if (name.norm === q) return isCode ? 100 : 90;
  if (name.norm.replace(/ /g, '') === qCompact) return 85;
  if (name.norm.startsWith(q)) return 70 - Math.min(20, (name.norm.length - q.length) / 4);
  if (name.words.some((w) => w.startsWith(q))) return 50;
  if (q.length >= 3 && name.norm.includes(q)) return 30;
  return 0;
}

export function search(entries: Entry[], query: string, limit = 8): Hit[] {
  const q = normalize(query);
  if (!q) return [];
  const qCompact = q.replace(/ /g, '');
  const hits: Hit[] = [];
  for (const e of entries) {
    let best = 0;
    let matched = e.names[0];
    for (const name of e.names) {
      const s = scoreName(q, qCompact, name, name.lang === '');
      if (s > best) {
        best = s;
        matched = name;
      }
    }
    if (best > 0) {
      // Prefer active intblocks and countries slightly when scores tie.
      const score = best + (e.active ? 1 : 0) + (e.kind === 'c' ? 0.5 : 0);
      hits.push({ kind: e.kind, id: e.id, label: e.label, path: e.path, active: e.active, matched: matched.text, lang: matched.lang, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit);
}

// Levenshtein distance, used by the 404 page to suggest IDs close to a mistyped one.
export function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
