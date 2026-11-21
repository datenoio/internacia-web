// Compare organizations (SPEC §8, V6; decisions under M2): the member sets of two to six intblocks.
//
// Maps: two intblocks get a colour per combination (only A, only B, both), the map's three colour
// slots. From three on, the overlap map is sequential by count, and each intblock gets a small map
// with two colours: members only in it, and members also in another selected intblock. Every
// tooltip and table row names the intblocks a country is in. Choosing an UpSet column shows that
// combination alone on the overlap map and in the table.
import { esc, n, upset } from './charts';
import { getJson, params, setParams } from './explore';
import { renderMap, type MapEntry } from './map';

interface Roster { id: string; name: string | null; type: string; current: boolean; link: string | null }
interface Block { id: string; name: string; _acronym: string | null; _roster: Roster[] }

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

let ids: string[] = [];
let selected: number | null = null;

// "A", "A and B", "A, B and C".
const listing = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const bits = (mask: number, count: number) => Array.from({ length: count }, (_, i) => i).filter((i) => (mask >> i) & 1);

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
  names: Map<string, string>; // code → name, the union
  maskOf: Map<string, number>; // code → bit i set when the code is in intblock i
  union: string[];
}

function model(blocks: Block[]): Model {
  const sets = blocks.map((d) => new Map(d._roster.filter((r) => r.current && (r.type === 'country' || r.type === 'territory')).map((r) => [r.id, r.name ?? r.id])));
  const names = new Map<string, string>();
  sets.forEach((s) => s.forEach((v, k) => names.set(k, v)));
  const maskOf = new Map<string, number>();
  for (const code of names.keys()) maskOf.set(code, sets.reduce((m, s, i) => (s.has(code) ? m | (1 << i) : m), 0));
  return { blocks, labels: blocks.map(shortName), sets, names, maskOf, union: [...names.keys()] };
}

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
    fig.querySelector('figcaption')!.innerHTML = `<strong title="${esc(fullName(d))}">${esc(m.labels[i])}</strong> <span class="muted small">${n(size)} members · ${n(only)} only here</span>`;
    fig.querySelector('.map-canvas')!.setAttribute('aria-label', `${fullName(d)}: ${n(size)} countries and territories, ${n(only)} of them in none of the other selected organizations.`);
    // Each small map fits its own members (the overlap map above shows them all in one view).
    void renderMap(fig, data, [...m.sets[i].keys()]);
  });
}

function upsetChart(m: Model) {
  const combos = [...new Set(m.maskOf.values())]
    .map((mask) => ({ mask, size: [...m.maskOf.values()].filter((x) => x === mask).length }))
    .sort((a, b) => b.size - a.size || a.mask - b.mask)
    .slice(0, 24);
  chart.innerHTML = upset({ sets: m.labels.map((label, i) => ({ label, size: m.sets[i].size })), combos, title: `Overlap of ${m.labels.join(', ')}`, selected });
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

function dataTable(m: Model) {
  const k = m.blocks.length;
  const rows = [...m.maskOf.entries()]
    .filter(([, mask]) => selected === null || mask === selected)
    .sort((a, b) => (m.names.get(a[0]) ?? '').localeCompare(m.names.get(b[0]) ?? ''));
  const head = `<tr><th scope="col">Country or territory</th><th scope="col">Code</th>${m.labels.map((l) => `<th scope="col">${esc(l)}</th>`).join('')}<th scope="col">In</th></tr>`;
  const body = rows
    .map(([code, mask]) => {
      const cells = m.labels.map((_, i) => `<td>${(mask >> i) & 1 ? '✓ member' : '–'}</td>`).join('');
      return `<tr data-member="${esc(code)}"><td><a href="${esc(`${base}countries/${code.toLowerCase()}/`)}">${esc(m.names.get(code))}</a></td><td><code>${esc(code)}</code></td>${cells}<td>${bits(mask, k).length} of ${k}</td></tr>`;
    })
    .join('');
  const note = selected !== null ? `<p class="small">Showing ${n(rows.length)} in ${esc(comboLabel(m, selected))}. <button type="button" data-clear>Show all</button></p>` : '';
  table.innerHTML = `${note}<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  table.querySelector('[data-clear]')?.addEventListener('click', () => ((selected = null), void draw()));
}

async function draw() {
  renderChips();
  setParams({ ids: ids.length ? ids : null });
  if (ids.length < 2) {
    status.textContent = 'Choose at least two organizations.';
    chart.innerHTML = '';
    table.innerHTML = '';
    legend.innerHTML = '';
    caption.textContent = '';
    void renderMap(figure, {}, []);
    miniMaps(model([]));
    return;
  }
  const docs = await Promise.all(ids.map((id) => getJson<{ data: Block }>(`${base}api/v1/blocks/${encodeURIComponent(id)}.json`).catch(() => null)));
  const blocks = docs.filter((d): d is { data: Block } => d !== null).map((d) => d.data);
  blocks.forEach((d) => known.set(d.id, { short: shortName(d), full: fullName(d) }));
  renderChips();
  const m = model(blocks);
  const all = (1 << blocks.length) - 1;
  const inAll = [...m.maskOf.values()].filter((x) => x === all).length;
  status.textContent = `${n(m.union.length)} countries and territories belong to at least one; ${n(inAll)} belong to all ${blocks.length}.`;
  upsetChart(m);
  overlapMap(m);
  miniMaps(m);
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
ids = (params().get('ids') ?? 'EU,NATO,OECD').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX);
void draw();
