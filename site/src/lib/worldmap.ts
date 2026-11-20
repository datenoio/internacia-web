// Base world map (SPEC §8): Natural Earth 1:110m from world-atlas, Equal Earth projection,
// rendered once at build time to a static SVG that every map on the site reuses.
//
// Polygons join on ISO 3166-1 numeric code. Kosovo has no numeric code in Natural Earth and is
// joined by name. Records without a 1:110m polygon (small islands and states) are drawn as dots at
// their centroid. Polygons that match no record (for example N. Cyprus, Somaliland) are drawn as
// neutral land with no label: the site takes no position on them (SPEC §9.4).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { countries } from './data';

const WIDTH = 1000;
const NAME_JOINS: Record<string, string> = { Kosovo: 'XK' };

type Box = [number, number, number, number];
let cached: { svg: string; width: number; height: number; polygons: Set<string>; dots: Set<string>; boxes: Map<string, Box> } | null = null;

export function worldMap() {
  if (cached) return cached;
  const require = createRequire(import.meta.url);
  const topo = JSON.parse(readFileSync(require.resolve('world-atlas/countries-110m.json'), 'utf-8'));
  const fc = feature(topo, topo.objects.countries) as unknown as GeoJSON.FeatureCollection;

  const sphere = { type: 'Sphere' } as const;
  const projection = geoEqualEarth().fitWidth(WIDTH, sphere);
  const path = geoPath(projection).digits(1);
  const [[, y0], [, y1]] = path.bounds(sphere);
  const height = Math.ceil(y1 - y0);

  const byNumeric = new Map(countries().filter((c) => c.numeric_code).map((c) => [c.numeric_code!, c.code]));
  const polygons = new Set<string>();
  const shapes: string[] = [];
  // Projected box of each record's largest polygon: the mainland, so that overseas parts (French
  // Guiana for France, Alaska for the United States) do not widen a zoomed view.
  const boxes = new Map<string, Box>();
  const mainBox = (g: GeoJSON.Geometry): Box => {
    if (g.type !== 'MultiPolygon') return path.bounds(g as GeoJSON.Polygon).flat() as Box;
    const parts = g.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }) as GeoJSON.Polygon);
    const largest = parts.reduce((a, b) => (path.area(b) > path.area(a) ? b : a));
    return path.bounds(largest).flat() as Box;
  };
  for (const f of fc.features) {
    const name = String(f.properties?.name ?? '');
    const code = (f.id !== undefined && byNumeric.get(String(f.id))) || NAME_JOINS[name];
    const d = path(f);
    if (!d) continue;
    if (code) {
      polygons.add(code);
      if (f.geometry) boxes.set(code, mainBox(f.geometry));
      shapes.push(`<path class="c" data-code="${code}" d="${d}"/>`);
    } else {
      shapes.push(`<path class="x" d="${d}"/>`);
    }
  }

  const dots = new Set<string>();
  const marks: string[] = [];
  for (const c of countries()) {
    if (polygons.has(c.code) || !c.centroid) continue;
    const point = projection([c.centroid.lng, c.centroid.lat]);
    if (!point) continue;
    dots.add(c.code);
    boxes.set(c.code, [point[0] - 6, point[1] - 6, point[0] + 6, point[1] + 6]);
    const [x, y] = point.map((v) => v.toFixed(1));
    marks.push(
      `<g class="dot" data-code="${c.code}" transform="translate(${x} ${y})"><circle class="hit" r="12"/><circle class="mark" r="4"/></g>`,
    );
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" class="world">
<defs><pattern id="map-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hatch-bg" width="6" height="6"/><line class="hatch-line" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>
<path class="sphere" d="${path(sphere)}"/>
<g class="land">${shapes.join('')}</g>
<g class="dots">${marks.join('')}</g>
</svg>
`;
  cached = { svg, width: WIDTH, height, polygons, dots, boxes };
  return cached;
}

export const onMap = (code: string): boolean => worldMap().polygons.has(code) || worldMap().dots.has(code);

// A viewBox around the given records, with the world map's aspect ratio (so the map keeps its
// size when it zooms), or null when they already cover most of the world.
export function viewFor(codes: Iterable<string>): string | null {
  const { width, height, boxes } = worldMap();
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const code of codes) {
    const b = boxes.get(code);
    if (!b) continue;
    x0 = Math.min(x0, b[0]);
    y0 = Math.min(y0, b[1]);
    x1 = Math.max(x1, b[2]);
    y1 = Math.max(y1, b[3]);
  }
  if (x0 === Infinity) return null;
  if (x1 - x0 > width * 0.6 || y1 - y0 > height * 0.6) return null;
  let w = Math.max((x1 - x0) * 1.25, width * 0.22);
  let h = Math.max((y1 - y0) * 1.25, height * 0.22);
  const ratio = width / height;
  if (w / h < ratio) w = h * ratio;
  else h = w / ratio;
  if (w > width * 0.8) return null;
  const x = Math.min(Math.max((x0 + x1) / 2 - w / 2, 0), width - w);
  const y = Math.min(Math.max((y0 + y1) / 2 - h / 2, 0), height - h);
  return [x, y, w, h].map((v) => v.toFixed(1)).join(' ');
}
