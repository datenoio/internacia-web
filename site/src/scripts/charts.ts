// SVG chart builders shared by the build (Astro set:html) and the browser (explorers).
// They follow the dataviz specs: thin columns (<= 24px) with a 4px rounded top and square base,
// a 2px surface gap between stacked segments, 2px lines, recessive gridlines, selective value
// labels, and a focusable hit area per mark with an aria-label (the tooltip's text).
// Every string that comes from data goes through esc().

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const fmt = new Intl.NumberFormat('en');
export const n = (v: number) => fmt.format(v);

export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= max) ?? max;
}

// Five sequential bins up to max, with round edges (for choropleths).
export function bins(max: number): { cls: string; min: number; max: number; label: string }[] {
  const top = Math.max(5, niceMax(max));
  const step = Math.ceil(top / 5);
  return Array.from({ length: 5 }, (_, i) => {
    const lo = i === 0 ? 1 : i * step + 1;
    const hi = i === 4 ? Infinity : (i + 1) * step;
    return { cls: `s${i + 1}`, min: lo, max: hi, label: hi === Infinity ? `${n(lo)} or more` : lo === hi ? n(lo) : `${n(lo)}–${n(hi)}` };
  });
}

const roundedTop = (x: number, top: number, w: number, base: number, r = 4) => {
  const h = base - top;
  if (h <= 0) return '';
  if (h <= r) return `M${x},${base}V${top}H${x + w}V${base}Z`;
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
};

export interface Stack {
  label: string; // category on the x axis
  parts: { series: number; value: number }[]; // series index into seriesNames
  key?: string; // value written to data-key on the mark group
}

// Column chart; with several series the columns are stacked (2px surface gap between segments).
export function columns(opts: {
  stacks: Stack[];
  seriesNames: string[];
  title: string;
  unit?: string;
  labelEvery?: number;
  selected?: string | null;
  width?: number;
  height?: number;
}): string {
  const { stacks, seriesNames, title, unit = '', labelEvery = 1, selected = null } = opts;
  const W = opts.width ?? 720;
  const H = opts.height ?? 220;
  const pad = { top: 18, right: 8, bottom: 28, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const base = pad.top + innerH;
  const totals = stacks.map((s) => s.parts.reduce((a, p) => a + p.value, 0));
  const top = niceMax(Math.max(0, ...totals));
  const y = (v: number) => base - (v / top) * innerH;
  const step = stacks.length ? innerW / stacks.length : innerW;
  const barW = Math.max(2, Math.min(24, step - 2));
  const peak = totals.indexOf(Math.max(...totals));
  const ticks = [0, top / 2, top]
    .map((t) => `<g class="tick"><line x1="${pad.left}" x2="${W - pad.right}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.left - 6}" y="${y(t) + 4}" text-anchor="end">${n(t)}</text></g>`)
    .join('');
  const labels: string[] = [];
  const marks = stacks
    .map((s, i) => {
      const x = pad.left + i * step + (step - barW) / 2;
      let acc = 0;
      const nonzero = s.parts.filter((p) => p.value > 0);
      const segs = nonzero
        .map((p, j) => {
          const y0 = y(acc);
          acc += p.value;
          const y1 = y(acc);
          const last = j === nonzero.length - 1;
          const gap = j > 0 ? 1 : 0; // 2px gap shared by neighbours
          const d = last
            ? roundedTop(x, y1, barW, y0 - gap)
            : `M${x},${y0 - gap}V${y1 + 1}H${x + barW}V${y0 - gap}Z`;
          return `<path class="bar series-${p.series + 1}" d="${d}"/>`;
        })
        .join('');
      const parts = s.parts.filter((p) => p.value > 0).map((p) => `${seriesNames[p.series]} ${n(p.value)}`).join(', ');
      const label = `${s.label}: ${n(totals[i])}${unit}${seriesNames.length > 1 && parts ? ` (${parts})` : ''}`;
      const axis = i % labelEvery === 0 ? `<text class="axis" x="${x + barW / 2}" y="${H - 10}" text-anchor="middle">${esc(s.label)}</text>` : '';
      const value = i === peak && totals[i] > 0 ? `<text class="value" x="${x + barW / 2}" y="${y(totals[i]) - 5}" text-anchor="middle">${n(totals[i])}</text>` : '';
      const sel = selected !== null && s.key === selected ? ' selected' : '';
      labels.push(axis, value);
      // Text labels live outside the focusable group, so its accessible name is the aria-label alone.
      return `<g class="col${sel}" tabindex="0" role="button" aria-pressed="${sel ? 'true' : 'false'}" aria-label="${esc(label)}" data-key="${esc(s.key ?? s.label)}"><title>${esc(label)}</title><rect class="hit" x="${pad.left + i * step}" y="${pad.top}" width="${step}" height="${innerH}"/>${segs}</g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(title)}">${ticks}${marks}<g class="labels" aria-hidden="true">${labels.join('')}</g><line class="baseline" x1="${pad.left}" x2="${W - pad.right}" y1="${base}" y2="${base}"/></svg>`;
}

// Step line of a count over years (2px line, end value labelled).
export function steps(opts: { points: { year: number; value: number }[]; title: string; marker?: number | null }): string {
  const { points, title, marker = null } = opts;
  const W = 720;
  const H = 220;
  const pad = { top: 18, right: 40, bottom: 28, left: 40 };
  if (!points.length) return '';
  const x0 = points[0].year;
  const x1 = points[points.length - 1].year;
  const top = niceMax(Math.max(...points.map((p) => p.value)));
  const x = (year: number) => pad.left + ((year - x0) / Math.max(1, x1 - x0)) * (W - pad.left - pad.right);
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / top);
  let d = `M${x(points[0].year)},${y(points[0].value)}`;
  for (let i = 1; i < points.length; i++) d += `H${x(points[i].year)}V${y(points[i].value)}`;
  const ticks = [0, top / 2, top]
    .map((t) => `<g class="tick"><line x1="${pad.left}" x2="${W - pad.right}" y1="${y(t)}" y2="${y(t)}"/><text x="${pad.left - 6}" y="${y(t) + 4}" text-anchor="end">${n(t)}</text></g>`)
    .join('');
  const span = x1 - x0;
  const every = span > 60 ? 20 : span > 30 ? 10 : span > 12 ? 5 : 1;
  const years = points
    .filter((p) => p.year % every === 0 || p.year === x0)
    .map((p) => `<text class="axis" x="${x(p.year)}" y="${H - 10}" text-anchor="middle">${p.year}</text>`)
    .join('');
  const last = points[points.length - 1];
  const mark =
    marker !== null && marker >= x0 && marker <= x1
      ? `<line class="marker" x1="${x(marker)}" x2="${x(marker)}" y1="${pad.top}" y2="${H - pad.bottom}"/>`
      : '';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${ticks}<path class="line" d="${d}"/>${mark}<circle class="end" cx="${x(last.year)}" cy="${y(last.value)}" r="4"/><text class="value" x="${x(last.year) + 6}" y="${y(last.value) + 4}">${n(last.value)}</text>${years}<line class="baseline" x1="${pad.left}" x2="${W - pad.right}" y1="${H - pad.bottom}" y2="${H - pad.bottom}"/></svg>`;
}

// Membership-status groups used by every map (SPEC §8, V1).
export type Group = 'm' | 'p' | 'o' | 'f';
export const GROUPS: Record<Group, string> = { m: 'Member', p: 'Other participation', o: 'Observer', f: 'Former member' };
export const RANK: Record<Group, number> = { m: 4, p: 3, o: 2, f: 1 };
export const groupOf = (status: string): Group =>
  status === 'member' || status === 'founding_member' ? 'm' : status === 'observer' ? 'o' : status === 'former_member' ? 'f' : 'p';

// UpSet chart (SPEC §8, V6): set sizes on the left, exclusive intersections as columns, and a dot
// matrix telling which sets each column combines. Columns are focusable buttons.
export function upset(opts: { sets: { label: string; size: number }[]; combos: { mask: number; size: number }[]; title: string; selected?: number | null }): string {
  const { sets, combos, title, selected = null } = opts;
  const rowH = 22;
  const left = 190;
  const colW = 26;
  const barTop = 22;
  const barH = 140;
  const W = left + Math.max(1, combos.length) * colW + 20;
  const H = barTop + barH + 14 + sets.length * rowH + 8;
  const max = niceMax(Math.max(1, ...combos.map((c) => c.size)));
  const setMax = Math.max(1, ...sets.map((s) => s.size));
  const matrixTop = barTop + barH + 14;
  const parts: string[] = [];
  const texts: string[] = [];
  sets.forEach((s, i) => {
    const y = matrixTop + i * rowH;
    const w = (s.size / setMax) * 70;
    parts.push(
      `<rect class="setbar" x="${left - 80 - w}" y="${y + 5}" width="${w}" height="10" rx="2"/><text x="${left - 86 - w}" y="${y + 14}" text-anchor="end" class="muted">${n(s.size)}</text><text x="${left - 6}" y="${y + 14}" text-anchor="end">${esc(s.label)}</text>`,
    );
  });
  combos.forEach((c, j) => {
    const x = left + j * colW;
    const h = (c.size / max) * barH;
    const members = sets.map((s, i) => ((c.mask >> i) & 1 ? s.label : null)).filter(Boolean) as string[];
    const label = `${members.join(' and ')}${members.length < sets.length ? ' only' : ''}: ${n(c.size)}`;
    const on = sets.map((_, i) => (c.mask >> i) & 1);
    const ys = on.map((v, i) => (v ? matrixTop + i * rowH + 10 : null)).filter((v) => v !== null) as number[];
    const link = ys.length > 1 ? `<line class="link" x1="${x + colW / 2}" x2="${x + colW / 2}" y1="${Math.min(...ys)}" y2="${Math.max(...ys)}"/>` : '';
    const dots = on.map((v, i) => `<circle class="dot${v ? ' on' : ''}" cx="${x + colW / 2}" cy="${matrixTop + i * rowH + 10}" r="5"/>`).join('');
    const sel = selected === c.mask ? ' selected' : '';
    texts.push(`<text class="value" x="${x + colW / 2}" y="${barTop + barH - h - 4}" text-anchor="middle">${n(c.size)}</text>`);
    parts.push(
      `<g class="col${sel}" tabindex="0" role="button" aria-pressed="${sel ? 'true' : 'false'}" aria-label="${esc(label)}" data-key="${c.mask}"><title>${esc(label)}</title><rect class="hit" x="${x}" y="${barTop}" width="${colW}" height="${H - barTop}"/><path class="bar series-1" d="${roundedTop(x + 4, barTop + barH - h, colW - 8, barTop + barH)}"/>${link}${dots}</g>`,
    );
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="upset" role="group" aria-label="${esc(title)}"><line class="baseline" x1="${left}" x2="${W - 20}" y1="${barTop + barH}" y2="${barTop + barH}"/>${parts.join('')}<g aria-hidden="true">${texts.join('')}</g></svg>`;
}
