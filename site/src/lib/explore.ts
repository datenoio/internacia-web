// Build-time data for explorers.
import { geoEqualEarth } from 'd3-geo';
import { blocks, countryByCode } from './data';
import { worldMap } from './worldmap';

export interface Hq {
  id: string;
  name: string;
  acronym: string | null;
  city: string;
  country: string | null;
  country_name: string | null;
  lat: number;
  lng: number;
  active: boolean;
}

let hq: Hq[] | null = null;
export function headquarters(): Hq[] {
  hq ??= blocks()
    .filter((b) => b.headquarters?.coordinates && Number.isFinite(b.headquarters.coordinates.lat))
    .map((b) => ({
      id: b.id,
      name: b.name,
      acronym: b._acronym,
      city: b.headquarters!.city ?? '',
      country: b.headquarters!.country ?? null,
      country_name: b.headquarters!.country ? (countryByCode().get(b.headquarters!.country)?.name ?? null) : null,
      lat: b.headquarters!.coordinates!.lat,
      lng: b.headquarters!.coordinates!.lng,
      active: b._active,
    }));
  return hq;
}

export interface Cluster {
  key: string;
  city: string;
  country: string | null;
  country_name: string | null;
  x: number;
  y: number;
  ids: string[];
  active: number;
}

// Cities as clusters: organizations in the same city and country share one point, placed at the
// mean of their coordinates, projected with the base map's projection.
export function hqClusters(): Cluster[] {
  const { width } = worldMap();
  const projection = geoEqualEarth().fitWidth(width, { type: 'Sphere' });
  const groups = new Map<string, Hq[]>();
  for (const h of headquarters()) {
    const key = `${h.city.trim().toLowerCase()}|${h.country ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const lat = list.reduce((s, h) => s + h.lat, 0) / list.length;
      const lng = list.reduce((s, h) => s + h.lng, 0) / list.length;
      const [x, y] = projection([lng, lat]) ?? [0, 0];
      return {
        key,
        city: list[0].city,
        country: list[0].country,
        country_name: list[0].country_name,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        ids: list.map((h) => h.id),
        active: list.filter((h) => h.active).length,
      };
    })
    .sort((a, b) => b.ids.length - a.ids.length || a.city.localeCompare(b.city));
}
