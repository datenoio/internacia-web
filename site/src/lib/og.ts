// Social images (SPEC §7.6): 1200×630 PNG per card, built at build time. The SVG is written by
// hand and rendered with resvg (Inter, OFL-1.1, from @expo-google-fonts/inter), then reduced to
// a small palette with sharp so 1,500 images stay around 30 KB each.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import type { Block, Country } from './data';
import { blocktypeLabel, enumLabel, num } from './format';
import { meta } from './meta';
import { groupOf } from '../scripts/charts';
import { worldMap } from './worldmap';

const require = createRequire(import.meta.url);
const FONTS = [
  require.resolve('@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf'),
  require.resolve('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
];

const W = 1200;
const H = 630;
const COLORS = { member: '#2a78d6', other: '#eb6834', observer: '#1baf7a', former: '#b8b7b0', land: '#e1e0d9' };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Greedy word wrap by an average character width; long words are cut.
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && lines.join(' ').length < text.length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.-]*\S{0,3}$/, '')}…`;
  }
  return lines;
}

let mapInner: string | null = null;
const baseMap = () => {
  // The base map's land and dots, without its CSS classes doing anything: fills are set per code.
  mapInner ??= worldMap()
    .svg.replace(/^[\s\S]*?<g class="land">/, '<g class="land">')
    .replace(/<\/svg>\s*$/, '');
  return mapInner;
};

function render(opts: { title: string; subtitle: string; fills: Record<string, string> }): string {
  const big = opts.title.length > 70;
  const size = big ? 46 : 60;
  const lines = wrap(opts.title, big ? 44 : 34, big ? 4 : 3);
  const lineH = Math.round(size * 1.15);
  const titleTop = 70 + size;
  const sub = wrap(opts.subtitle, 70, 2);
  const subTop = titleTop + (lines.length - 1) * lineH + 52;
  const mapTop = subTop + (sub.length - 1) * 38 + 36;
  const mapH = Math.max(150, 560 - mapTop);
  const scale = Math.min(700 / worldMap().width, mapH / worldMap().height);
  const mapW = worldMap().width * scale;
  const fills = Object.entries(opts.fills)
    .map(([code, color]) => `[data-code="${code}"]{fill:${color}}`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect width="${W}" height="10" fill="${COLORS.member}"/>
${lines.map((l, i) => `<text x="64" y="${titleTop + i * lineH}" font-family="Inter" font-weight="700" font-size="${size}" fill="#1b1e23">${esc(l)}</text>`).join('\n')}
${sub.map((l, i) => `<text x="64" y="${subTop + i * 38}" font-family="Inter" font-size="30" fill="#5b616b">${esc(l)}</text>`).join('\n')}
<g transform="translate(${W - 64 - mapW} ${mapTop}) scale(${scale})"><style>.c,.x{fill:${COLORS.land};stroke:#ffffff;stroke-width:0.6}.sphere{fill:none}.dot{display:none}.dot .hit{fill:none}${fills}${Object.keys(opts.fills)
    .map((c) => `.dot[data-code="${c}"]{display:inline}.dot[data-code="${c}"] .mark{fill:${opts.fills[c]}}`)
    .join('')}</style>${baseMap()}</g>
<text x="64" y="${H - 40}" font-family="Inter" font-weight="700" font-size="26" fill="#1b1e23">Internacia</text>
<text x="200" y="${H - 40}" font-family="Inter" font-size="26" fill="#5b616b">internacia-db v${esc(meta.data.version)} · CC BY 4.0</text>
</svg>`;
}

async function png(svg: string): Promise<Uint8Array> {
  const raw = new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng();
  return new Uint8Array(await sharp(raw).png({ palette: true, colours: 16, effort: 4, compressionLevel: 9 }).toBuffer());
}

export function blockImage(b: Block): Promise<Uint8Array> {
  const fills: Record<string, string> = {};
  for (const r of b._roster) {
    if (r.link !== 'country') continue;
    const g = b._active ? (r.current ? groupOf(r.status) : 'f') : groupOf(r.status);
    const color = g === 'm' ? COLORS.member : g === 'o' ? COLORS.observer : g === 'p' ? COLORS.other : COLORS.former;
    if (!fills[r.id] || color === COLORS.member) fills[r.id] = color;
  }
  const kind = b.scope_category ? enumLabel('scope_category', b.scope_category) : blocktypeLabel(b.blocktype[0]);
  const subtitle = b._active
    ? `${kind} · ${num(b._current_member_count)} current member countries and territories`
    : `${kind} · ${enumLabel('status', b.status)}${b.dissolved ? `, dissolved ${b.dissolved}` : ''}`;
  return png(render({ title: b._acronym ? `${b.name} (${b._acronym})` : b.name, subtitle, fills }));
}

export function countryImage(c: Country): Promise<Uint8Array> {
  const subtitle = `${enumLabel('entity_type', c.entity_type)} · ${c.code} / ${c.iso3code} · ${num(c._current_member_count)} current memberships`;
  return png(render({ title: c.name, subtitle, fills: { [c.code]: COLORS.member } }));
}

export function defaultImage(countries: Country[]): Promise<Uint8Array> {
  const fills = Object.fromEntries(countries.map((c) => [c.code, '#86b6ef']));
  return png(
    render({
      title: 'Internacia',
      subtitle: `${num(meta.counts.countries)} countries and territories, ${num(meta.counts.intblocks)} international organizations and groupings`,
      fills,
    }),
  );
}
