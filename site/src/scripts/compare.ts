// Compare organizations (SPEC §8, V6; decisions under M2): the member sets of two to six intblocks.
//
// Maps: two intblocks get a colour per combination (only A, only B, both), the map's three colour
// slots. From three on, the overlap map is sequential by count, and each intblock gets a small map
// with two colours: members only in it, and members also in another selected intblock. Every
// tooltip and table row names the intblocks a country is in. Choosing an UpSet column shows that
// combination alone on the overlap map and in the table.
//
// Measure (?measure=): the UpSet chart, the pairwise matrix and the composition tables count
// countries, population or land area. Sums run over the members that have a value; the size note
// names the years and sources summed. Nothing here sorts or ranks countries by these values.
import { esc, n, upset } from './charts';
import { getJson, params, setParams } from './explore';
import { renderMap, type MapEntry } from './map';

interface Roster { id: string; name: string | null; type: string; status: string; current: boolean; link: string | null }
interface Block {
  id: string;
  name: string;
  _acronym: string | null;
  _roster: Roster[];
  blocktype?: string[];
  status?: string;
  scope_category?: string | null;
  geographic_scope?: string | null;
  founded?: string | null;
  dissolved?: string | null;
  headquarters?: { city?: string; country?: string } | null;
  _hq_country_name?: string | null;
  institutional_design?: Record<string, unknown> | null;
}
interface Indicator { value: number; year: number | null; source: string | null; source_id: string | null }
interface Country { code: string; name: string; continents: string[]; population: Indicator | null; area: Indicator | null }
interface Labels {
  blocktype: Record<string, string>;
  statuses: Record<string, string>;
  status: Record<string, string>;
  scope_category: Record<string, string>;
  geographic_scope: Record<string, string>;
  design: { field: string; label: string; values: Record<string, string> }[];
}

type Measure = 'count' | 'population' | 'area';
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 3 });
const MEASURES: Record<Measure, { title: string; short: (v: number) => string; long: (v: number) => string }> = {
  count: { title: 'countries and territories', short: n, long: (v) => `${n(v)} ${v === 1 ? 'country or territory' : 'countries and territories'}` },
  population: { title: 'population', short: (v) => compact.format(v), long: (v) => `${n(Math.round(v))} people` },
  area: { title: 'land area (km²)', short: (v) => compact.format(v), long: (v) => `${n(Math.round(v))} km²` },
};
const isMeasure = (v: string | null): v is Measure => v === 'count' || v === 'population' || v === 'area';

// World Bank income groups: wbgroup intblocks in internacia-db (SPEC §6.8), highest first.
const INCOME = ['HIC', 'UMC', 'LMC', 'LIC'];
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];
const NONE = '';

const MAX = 6;
const root = document.querySelector<HTMLElement>('[data-explorer="compare"]')!;
const base = root.dataset.base!;
const input = root.querySelector<HTMLInputElement>('[data-input="block"]')!;
const chips = root.querySelector<HTMLElement>('[data-chips]')!;
const status = root.querySelector<HTMLElement>('[data-status]')!;
const chart = root.querySelector<HTMLElement>('[data-chart]')!;
const table = root.querySelector<HTMLElement>('[data-table]')!;
const figure = document.getElementById('compare-map')!;
const legend = figure.querySelector<HTMLElement>('[data-legend]')!;
const caption = figure.querySelector<HTMLElement>('[data-caption]')!;
const miniSection = root.querySelector<HTMLElement>('[data-minis]')!;
const miniGrid = miniSection.querySelector<HTMLElement>('[data-mini-grid]')!;
const ratio = figure.querySelector('.map-canvas')?.getAttribute('style') ?? '';
const el = (name: string) => root.querySelector<HTMLElement>(`[data-${name}]`)!;
const L = JSON.parse(document.getElementById('compare-labels')?.textContent ?? '{}') as Labels;

let ids: string[] = [];
let selected: number | null = null;
let measure: Measure = 'count';

// "A", "A and B", "A, B and C".
const listing = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const bits = (mask: number, count: number) => Array.from({ length: count }, (_, i) => i).filter((i) => (mask >> i) & 1);
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : '–');
// Five sequential steps, as on the Statistics page; zero has no fill.
const heat = (share: number) => (share > 0 ? `heat h${Math.min(5, Math.floor(share * 5) + (share === 1 ? 0 : 1))}` : '');
const humanize = (key: string) => key.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const label = (dict: Record<string, string> | undefined, key: string | null | undefined) => (key ? (dict?.[key] ?? humanize(key)) : '');
const blockHref = (id: string) => `${base}blocks/${id.toLowerCase()}/`;
const countryHref = (code: string) => `${base}countries/${code.toLowerCase()}/`;

const shortName = (d: Block) => d._acronym ?? d.name;
const fullName = (d: Block) => `${d.name}${d._acronym ? ` (${d._acronym})` : ''}`;
// Chips show the organization's acronym or name (full name on hover), once it is known.
const known = new Map<string, { short: string; full: string }>();

function renderChips() {
  chips.innerHTML = ids
    .map((id) => {
      const k = known.get(id);
      // The accessible name repeats the visible text (axe: label-content-name-mismatch); the full
      // name is the button's description.
      return `<li><button type="button" data-remove="${esc(id)}" title="${esc(k?.full ?? id)}" aria-label="Remove ${esc(k?.short ?? id)}">${esc(k?.short ?? id)} ×</button></li>`;
    })
    .join('');
  chips.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      ids = ids.filter((x) => x !== b.dataset.remove);
      selected = null;
      void draw();
    }),
  );
}

// Everything the views need, computed once per draw.
interface Model {
  blocks: Block[];
  labels: string[];
  sets: Map<string, string>[]; // code → name, per intblock
  statusOf: Map<string, string>[]; // code → roster status (member, observer, partner…), per intblock
  names: Map<string, string>; // code → name, the union
  maskOf: Map<string, number>; // code → bit i set when the code is in intblock i
  union: string[];
  countries: Map<string, Country>;
  income: { id: string; name: string; members: Set<string> }[];
}

const members = (d: Block) => d._roster.filter((r) => r.current && (r.type === 'country' || r.type === 'territory'));

function model(blocks: Block[], countries: Map<string, Country> = new Map(), income: Block[] = []): Model {
  const sets = blocks.map((d) => new Map(members(d).map((r) => [r.id, r.name ?? r.id])));
  const statusOf = blocks.map((d) => new Map(members(d).map((r) => [r.id, r.status])));
  const names = new Map<string, string>();
  sets.forEach((s) => s.forEach((v, k) => names.set(k, v)));
  const maskOf = new Map<string, number>();
  for (const code of names.keys()) maskOf.set(code, sets.reduce((m, s, i) => (s.has(code) ? m | (1 << i) : m), 0));
  return {
    blocks,
    labels: blocks.map(shortName),
    sets,
    statusOf,
    names,
    maskOf,
    union: [...names.keys()],
    countries,
    income: income.map((d) => ({ id: d.id, name: d.name, members: new Set(members(d).map((r) => r.id)) })),
  };
}

// The value a member adds under a measure: 1, or its population or land area (0 without a value).
function weight(m: Model, code: string, how: Measure = measure): number {
  if (how === 'count') return 1;
  return m.countries.get(code)?.[how]?.value ?? 0;
}
const total = (m: Model, codes: Iterable<string>, how: Measure = measure) => {
  let sum = 0;
  for (const code of codes) sum += weight(m, code, how);
  return sum;
};

// "EU and NATO only", "EU, NATO and OECD" (all of them), as in the UpSet chart.
function comboLabel(m: Model, mask: number) {
  const on = bits(mask, m.blocks.length).map((i) => m.labels[i]);
  return `${listing(on)}${on.length < m.blocks.length ? ' only' : ''}`;
}

const legendItem = (cls: string, text: string) => `<li><span class="swatch ${cls}" aria-hidden="true"></span>${esc(text)}</li>`;

function overlapMap(m: Model) {
  const k = m.blocks.length;
  const data: Record<string, MapEntry> = {};
  const count = (pred: (mask: number) => boolean) => [...m.maskOf.values()].filter(pred).length;
  for (const [code, mask] of m.maskOf) {
    const name = m.names.get(code) ?? code;
    const on = bits(mask, k).map((i) => m.labels[i]);
    if (selected !== null) {
      if (mask === selected) data[code] = ['g-m', comboLabel(m, mask), '', name];
    } else if (k === 2) {
      data[code] = mask === 3 ? ['g-m', `In both: ${listing(m.labels)}`, '', name] : [mask === 1 ? 'g-p' : 'g-o', `Only ${on[0]}`, '', name];
    } else {
      const step = Math.max(1, Math.round((on.length / k) * 5));
      data[code] = [`s${step}`, `In ${on.length} of ${k}: ${listing(on)}`, '', name];
    }
  }
  // The view fits the union, so it stays put when a combination is chosen.
  void renderMap(figure, data, m.union);
  if (selected !== null) {
    const size = count((x) => x === selected);
    legend.innerHTML = legendItem('g-m', `${comboLabel(m, selected)} (${n(size)})`);
    caption.textContent = `Only the combination chosen in the chart above. Choose its column again to show all ${n(m.union.length)}.`;
  } else if (k === 2) {
    legend.innerHTML = [
      legendItem('g-p', `Only ${m.labels[0]} (${n(count((x) => x === 1))})`),
      legendItem('g-o', `Only ${m.labels[1]} (${n(count((x) => x === 2))})`),
      legendItem('g-m', `Both (${n(count((x) => x === 3))})`),
    ].join('');
    caption.textContent = `Countries and territories in ${listing(m.labels)}.`;
  } else {
    legend.innerHTML = Array.from({ length: k }, (_, i) => i + 1)
      .map((c) => legendItem(`s${Math.max(1, Math.round((c / k) * 5))}`, `In ${c} (${n(count((x) => bits(x, k).length === c))})`))
      .join('');
    caption.textContent = `Countries and territories by how many of the ${k} organizations they belong to; the maps below show each organization.`;
  }
}

// Small maps, one per intblock, from three intblocks on. Figures are kept per intblock between
// draws, so the base map is parsed once for each.
const minis = new Map<string, HTMLElement>();
function miniFigure(id: string): HTMLElement {
  let fig = minis.get(id);
  if (!fig) {
    fig = document.createElement('figure');
    fig.className = 'map mini';
    fig.dataset.src = figure.dataset.src!;
    fig.dataset.static = '';
    fig.innerHTML = `<figcaption></figcaption><div class="map-canvas" style="${esc(ratio)}" role="img"></div><div class="map-tip" hidden></div>`;
    minis.set(id, fig);
  }
  return fig;
}

function miniMaps(m: Model) {
  const k = m.blocks.length;
  miniSection.hidden = k < 3;
  for (const [id, fig] of minis) if (k < 3 || !m.blocks.some((d) => d.id === id)) (fig.remove(), minis.delete(id));
  if (k < 3) return;
  m.blocks.forEach((d, i) => {
    const fig = miniFigure(d.id);
    miniGrid.append(fig); // appending in order also sorts the figures
    const data: Record<string, MapEntry> = {};
    let only = 0;
    for (const [code, name] of m.sets[i]) {
      const mask = m.maskOf.get(code)!;
      const others = bits(mask & ~(1 << i), k).map((j) => m.labels[j]);
      if (!others.length) only++;
      data[code] = others.length ? ['g-m', `Also in ${listing(others)}`, '', name] : ['g-p', `Only in ${m.labels[i]}`, '', name];
    }
    const size = m.sets[i].size;
    fig.querySelector('figcaption')!.innerHTML = `<strong title="${esc(fullName(d))}">${esc(m.labels[i])}</strong> <span class="muted small">${n(size)} in all · ${n(only)} only here</span>`;
    fig.querySelector('.map-canvas')!.setAttribute('aria-label', `${fullName(d)}: ${n(size)} countries and territories, ${n(only)} of them in none of the other selected organizations.`);
    // Each small map fits its own members (the overlap map above shows them all in one view).
    void renderMap(fig, data, [...m.sets[i].keys()]);
  });
}

function upsetChart(m: Model) {
  const sizeOf = new Map<number, number>();
  for (const [code, mask] of m.maskOf) sizeOf.set(mask, (sizeOf.get(mask) ?? 0) + weight(m, code));
  const combos = [...sizeOf.entries()]
    .map(([mask, size]) => ({ mask, size }))
    .sort((a, b) => b.size - a.size || a.mask - b.mask)
    .slice(0, 24);
  const by = measure === 'count' ? '' : ` by ${MEASURES[measure].title}`;
  chart.innerHTML = upset({
    sets: m.labels.map((label, i) => ({ label, size: total(m, m.sets[i].keys()) })),
    combos,
    title: `Overlap of ${m.labels.join(', ')}${by}`,
    selected,
    format: MEASURES[measure].short,
  });
  chart.querySelectorAll<SVGGElement>('.col').forEach((g) => {
    const pick = () => {
      const mask = Number(g.dataset.key);
      selected = selected === mask ? null : mask;
      void draw().then(() => chart.querySelector<SVGGElement>(`.col[data-key="${mask}"]`)?.focus());
    };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick()));
  });
}

// Size: members, population and land area of each intblock, as bar lists (the text doubles as
// the data). Shares are of the total over all country records, not a world figure.
function sizeSection(m: Model) {
  const all = [...m.countries.keys()];
  const k = m.blocks.length;
  const inAll = [...m.maskOf.entries()].filter(([, x]) => x === (1 << k) - 1).map(([c]) => c);
  const group = (how: Measure, heading: string) => {
    const values = m.sets.map((s) => total(m, s.keys(), how));
    const max = Math.max(1, ...values);
    const whole = how === 'count' ? 0 : total(m, all, how);
    const share = (v: number) => (whole ? ` · ${pct(v, whole)}` : '');
    const items = values
      .map((v, i) => {
        const text = `${MEASURES[how].short(v)}${share(v)}`;
        return `<li title="${esc(`${fullName(m.blocks[i])}: ${MEASURES[how].long(v)}`)}"><span>${esc(m.labels[i])}</span><span class="bar"><span class="fill" style="width: calc(${((v / max) * 100).toFixed(1)}% - 7rem)"></span><span class="value">${esc(text)}</span></span></li>`;
      })
      .join('');
    const union = total(m, m.union, how);
    const both = total(m, inAll, how);
    return `<div><h3>${esc(heading)}</h3><ul class="bars" aria-label="${esc(heading)}">${items}</ul><p class="small muted">At least one: ${esc(MEASURES[how].short(union))}${esc(share(union))} · all ${k}: ${esc(MEASURES[how].short(both))}${esc(share(both))}</p></div>`;
  };
  el('size').innerHTML = [group('count', 'Countries and territories'), group('population', 'Population'), group('area', 'Land area, km²')].join('');
  // Years and sources summed, over the members of at least one intblock.
  const provenance = (how: 'population' | 'area') => {
    const groups = new Map<string, string[]>();
    for (const code of m.union) {
      const v = m.countries.get(code)?.[how];
      const key = v ? `${v.source ?? 'source unknown'}, ${v.year ?? 'year unknown'}` : 'no value';
      groups.set(key, [...(groups.get(key) ?? []), code]);
    }
    return [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, codes]) => `${key} for ${n(codes.length)}${codes.length <= 5 ? ` (${codes.sort().join(', ')})` : ''}`)
      .join('; ');
  };
  el('size-note').textContent =
    `Population: ${provenance('population')}. Land area: ${provenance('area')}. ` +
    `Shares are of the total over all ${n(all.length)} country records in internacia-db: ${MEASURES.population.long(total(m, all, 'population'))} and ${MEASURES.area.long(total(m, all, 'area'))}, Antarctica included.`;
}

// What the shares are of: countries and territories (observers and partners included), or a sum.
const what = () => (measure === 'count' ? 'countries and territories' : MEASURES[measure].title.replace(' (km²)', ''));

// Pairwise: the share of the row intblock (by the measure) that is also in the column intblock.
function pairsSection(m: Model) {
  el('pairs-lead').textContent = `Share of the row organization's ${what()} also in the column organization.`;
  const head = `<tr><th scope="col">Organization</th>${m.labels.map((l) => `<th scope="col" class="num">also in ${esc(l)}</th>`).join('')}</tr>`;
  const body = m.blocks
    .map((_, i) => {
      const own = total(m, m.sets[i].keys());
      const cells = m.blocks
        .map((__, j) => {
          if (i === j) return '<td class="num muted">–</td>';
          const shared = total(m, [...m.sets[i].keys()].filter((c) => m.sets[j].has(c)));
          const title = `Of ${m.labels[i]}'s ${MEASURES[measure].long(own)}, ${MEASURES[measure].long(shared)} also in ${m.labels[j]}`;
          return `<td class="num ${heat(own ? shared / own : 0)}" title="${esc(title)}">${pct(shared, own)} <span class="small">(${esc(MEASURES[measure].short(shared))})</span></td>`;
        })
        .join('');
      return `<tr><th scope="row">${esc(m.labels[i])}</th>${cells}</tr>`;
    })
    .join('');
  el('pairs').innerHTML = `<table class="data coverage"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

// Composition table: rows are intblocks, columns are parts (continents, income groups).
function compositionTable(m: Model, parts: { key: string; head: string }[], partsOf: (code: string) => string[]) {
  const head = `<tr><th scope="col">Organization</th>${parts.map((p) => `<th scope="col" class="num">${p.head}</th>`).join('')}</tr>`;
  const body = m.blocks
    .map((_, i) => {
      const own = total(m, m.sets[i].keys());
      const cells = parts
        .map((p) => {
          const part = total(m, [...m.sets[i].keys()].filter((c) => partsOf(c).includes(p.key)));
          return part ? `<td class="num ${heat(own ? part / own : 0)}">${pct(part, own)} <span class="small">(${esc(MEASURES[measure].short(part))})</span></td>` : '<td class="num muted">–</td>';
        })
        .join('');
      return `<tr><th scope="row">${esc(m.labels[i])}</th>${cells}</tr>`;
    })
    .join('');
  return `<table class="data coverage"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function compositionSection(m: Model) {
  const continentsOf = (code: string) => {
    const c = m.countries.get(code)?.continents ?? [];
    return c.length ? c : [NONE];
  };
  const present = new Set(m.union.flatMap(continentsOf));
  const continents = [...CONTINENTS, ...[...present].filter((c) => c !== NONE && !CONTINENTS.includes(c)).sort(), NONE]
    .filter((c) => present.has(c))
    .map((c) => ({ key: c, head: c === NONE ? 'No continent' : esc(c) }));
  el('continents').innerHTML = compositionTable(m, continents, continentsOf);
  const two = m.union.filter((c) => (m.countries.get(c)?.continents.length ?? 0) > 1).map((c) => m.names.get(c) ?? c);
  el('continents-note').textContent = `Share of each organization's ${what()} by continent.${
    two.length ? ` ${listing(two.sort())} ${two.length === 1 ? 'lies' : 'lie'} on two continents and count${two.length === 1 ? 's' : ''} in both, so a row can add up to more than 100 %.` : ''
  }`;
  const incomeOf = (code: string) => {
    const g = m.income.filter((x) => x.members.has(code)).map((x) => x.id);
    return g.length ? g : [NONE];
  };
  const groups = [...m.income.map((g) => ({ key: g.id, head: `<a href="${esc(blockHref(g.id))}">${esc(g.name)}</a>` })), { key: NONE, head: 'Not classified' }].filter(
    (g) => g.key !== NONE || m.union.some((c) => incomeOf(c)[0] === NONE),
  );
  el('income').innerHTML = compositionTable(m, groups, incomeOf);
}

// Profiles side by side: the card facts that describe each intblock, institutional design last.
function profilesSection(m: Model) {
  const notRecorded = '<span class="muted">not recorded</span>';
  const cell = (text: string) => (text ? esc(text) : notRecorded);
  const rows: [string, string[]][] = [
    ['Name', m.blocks.map((d) => esc(d.name))],
    ['Block type', m.blocks.map((d) => cell((d.blocktype ?? []).map((t) => label(L.blocktype, t)).join(', ')))],
    ['Status', m.blocks.map((d) => cell(label(L.status, d.status)))],
    ['Scope', m.blocks.map((d) => cell(label(L.scope_category, d.scope_category)))],
    ['Geographic scope', m.blocks.map((d) => cell(label(L.geographic_scope, d.geographic_scope)))],
    ['Founded', m.blocks.map((d) => cell(`${d.founded ?? ''}${d.dissolved ? `, dissolved ${d.dissolved}` : ''}`))],
    ['Headquarters', m.blocks.map((d) => cell([d.headquarters?.city, d._hq_country_name ?? d.headquarters?.country].filter(Boolean).join(', ')))],
    ['Countries and territories', m.sets.map((s) => esc(n(s.size)))],
  ];
  const designs = m.blocks.map((d) => d.institutional_design ?? {});
  const fields = [...(L.design ?? []).map((f) => f.field), ...designs.flatMap((x) => Object.keys(x))].filter((f, i, xs) => xs.indexOf(f) === i);
  for (const field of fields) {
    if (!designs.some((x) => x[field] !== undefined && x[field] !== null)) continue;
    const meta = L.design?.find((f) => f.field === field);
    rows.push([
      meta?.label ?? humanize(field),
      designs.map((x) => {
        const raw = x[field];
        const items = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw];
        if (!items.length) return notRecorded;
        return esc(
          items
            .map((v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : field === 'veto_holders' ? (m.countries.get(String(v))?.name ?? String(v)) : label(meta?.values, String(v))))
            .join(', '),
        );
      }),
    ]);
  }
  const head = `<tr><th scope="col"><span class="visually-hidden">Fact</span></th>${m.blocks.map((d, i) => `<th scope="col"><a href="${esc(blockHref(d.id))}">${esc(m.labels[i])}</a></th>`).join('')}</tr>`;
  const body = rows.map(([name, cells]) => `<tr><th scope="row">${esc(name)}</th>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
  el('profiles').innerHTML = `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

const indicatorCell = (v: Indicator | null | undefined) => (v ? `${n(v.value)} <span class="muted small">(${v.year ?? 'year unknown'})</span>` : '<span class="muted">–</span>');

function dataTable(m: Model) {
  const k = m.blocks.length;
  const rows = [...m.maskOf.entries()]
    .filter(([, mask]) => selected === null || mask === selected)
    .sort((a, b) => (m.names.get(a[0]) ?? '').localeCompare(m.names.get(b[0]) ?? ''));
  const head = `<tr><th scope="col">Country or territory</th><th scope="col">Code</th>${m.labels.map((l) => `<th scope="col">${esc(l)}</th>`).join('')}<th scope="col">In</th><th scope="col" class="num">Population</th><th scope="col" class="num">Land area, km²</th></tr>`;
  const body = rows
    .map(([code, mask]) => {
      const c = m.countries.get(code);
      const cells = m.labels.map((_, i) => `<td>${(mask >> i) & 1 ? `✓ ${esc(label(L.statuses, m.statusOf[i].get(code)).toLowerCase())}` : '–'}</td>`).join('');
      return `<tr data-member="${esc(code)}"><td><a href="${esc(countryHref(code))}">${esc(m.names.get(code))}</a></td><td><code>${esc(code)}</code></td>${cells}<td>${bits(mask, k).length} of ${k}</td><td class="num">${indicatorCell(c?.population)}</td><td class="num">${indicatorCell(c?.area)}</td></tr>`;
    })
    .join('');
  const note = selected !== null ? `<p class="small">Showing ${n(rows.length)} in ${esc(comboLabel(m, selected))}. <button type="button" data-clear>Show all</button></p>` : '';
  table.innerHTML = `${note}<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  table.querySelector('[data-clear]')?.addEventListener('click', () => ((selected = null), void draw()));
}

const blockDoc = (id: string) => getJson<{ data: Block }>(`${base}api/v1/blocks/${encodeURIComponent(id)}.json`).then((d) => d.data);
// Loaded once: the countries list (population, area, continents) and the income groups.
let shared: Promise<[Map<string, Country>, Block[]]> | null = null;
const loadShared = () =>
  (shared ??= Promise.all([
    getJson<{ data: Country[] }>(`${base}api/v1/countries.json`).then((d) => new Map(d.data.map((c) => [c.code, c]))),
    Promise.all(INCOME.map((id) => blockDoc(id).catch(() => null))).then((xs) => xs.filter((x): x is Block => x !== null)),
  ]));

async function draw() {
  renderChips();
  setParams({ ids: ids.length ? ids : null, measure: measure === 'count' ? null : measure });
  if (ids.length < 2) {
    status.textContent = 'Choose at least two organizations.';
    for (const x of [chart, table, legend, el('size'), el('pairs'), el('continents'), el('income'), el('profiles')]) x.innerHTML = '';
    for (const x of [caption, el('size-note'), el('pairs-lead'), el('continents-note')]) x.textContent = '';
    void renderMap(figure, {}, []);
    miniMaps(model([]));
    return;
  }
  const [docs, [countries, income]] = await Promise.all([Promise.all(ids.map((id) => blockDoc(id).catch(() => null))), loadShared()]);
  const blocks = docs.filter((d): d is Block => d !== null);
  blocks.forEach((d) => known.set(d.id, { short: shortName(d), full: fullName(d) }));
  renderChips();
  const m = model(blocks, countries, income);
  const all = (1 << blocks.length) - 1;
  const inAll = [...m.maskOf.entries()].filter(([, x]) => x === all).map(([c]) => c);
  const extra = measure === 'count' ? '' : ` By ${MEASURES[measure].title}: ${MEASURES[measure].short(total(m, m.union))} in at least one, ${MEASURES[measure].short(total(m, inAll))} in all.`;
  status.textContent = `${n(m.union.length)} countries and territories belong to at least one; ${n(inAll.length)} belong to all ${blocks.length}.${extra}`;
  upsetChart(m);
  overlapMap(m);
  miniMaps(m);
  sizeSection(m);
  pairsSection(m);
  compositionSection(m);
  profilesSection(m);
  dataTable(m);
}

input.addEventListener('change', () => {
  const [id, name] = input.value.split(' — ').map((s) => s.trim());
  if (id && name && !known.has(id)) known.set(id, { short: id, full: name });
  if (id && !ids.includes(id) && ids.length < MAX) ids.push(id);
  input.value = '';
  selected = null;
  void draw();
});
const radios = root.querySelectorAll<HTMLInputElement>('[data-measure] input[name="measure"]');
radios.forEach((r) =>
  r.addEventListener('change', () => {
    if (r.checked && isMeasure(r.value)) {
      measure = r.value;
      void draw();
    }
  }),
);
const fromUrl = params().get('measure');
if (isMeasure(fromUrl)) measure = fromUrl;
radios.forEach((r) => (r.checked = r.value === measure));
ids = (params().get('ids') ?? 'EU,NATO,OECD').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX);
void draw();
