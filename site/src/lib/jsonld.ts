// schema.org JSON-LD (SPEC §7.5). schema.org has no property that makes a Place a member of an
// Organization, so memberships are published as ItemList blocks, never as memberOf / member.
import type { Block, Country } from './data';
import { meta } from './meta';
import { absolute, blockPath, countryPath, geonamesUrl, path, wikidataUrl } from './urls';

type Ld = Record<string, unknown>;

export const toScript = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

export function breadcrumbList(items: { name: string; href: string }[]): Ld {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absolute(item.href),
    })),
  };
}

const prop = (propertyID: string, value: string | undefined) =>
  value ? { '@type': 'PropertyValue', propertyID, value } : null;

export function countryLd(c: Country): Ld[] {
  const url = absolute(countryPath(c.code));
  const names = new Set<string>([
    ...(c.official_name ? [c.official_name] : []),
    ...(c.common_names ?? []),
    ...(c.other_names ?? []).map((n) => n.name),
  ]);
  names.delete(c.name);
  const sameAs = [
    c.wikidata_id ? wikidataUrl(c.wikidata_id) : null,
    c.geonames_id ? geonamesUrl(c.geonames_id) : null,
  ].filter(Boolean);
  const current = c._memberships.filter((m) => m.current);
  return [
    {
      '@type': 'Country',
      '@id': `${url}#entity`,
      name: c.name,
      url,
      ...(names.size ? { alternateName: [...names] } : {}),
      identifier: [
        prop('ISO 3166-1 alpha-2', c.code),
        prop('ISO 3166-1 alpha-3', c.iso3code),
        prop('ISO 3166-1 numeric', c.numeric_code),
        prop('UN M49', c.m49_code),
        prop('Wikidata', c.wikidata_id),
        prop('GeoNames', c.geonames_id),
      ].filter(Boolean),
      ...(sameAs.length ? { sameAs } : {}),
      ...(c.centroid ? { geo: { '@type': 'GeoCoordinates', latitude: c.centroid.lat, longitude: c.centroid.lng } } : {}),
    },
    {
      '@type': 'ItemList',
      name: `Current memberships of ${c.name}`,
      numberOfItems: current.length,
      itemListElement: current.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'Organization', name: m.block_name, url: absolute(blockPath(m.block_id)) },
      })),
    },
  ];
}

export function blockType(b: Block): string {
  if (b.scope_category === 'reference_enumeration' || b.blocktype[0] === 'agreement') return 'DefinedTerm';
  if (b.scope_category === 'igo' || b.scope_category === 'intergovernmental_body') return 'GovernmentOrganization';
  return 'Organization';
}

export function blockLd(b: Block): Ld[] {
  const url = absolute(blockPath(b.id));
  const type = blockType(b);
  const alternateName = [
    ...new Set([...(b.acronyms ?? []).map((a) => a.value), ...(b.other_names ?? []).map((n) => n.name)]),
  ].filter((n) => n !== b.name);
  const sameAs = [
    b.wikidata_id ? wikidataUrl(b.wikidata_id) : null,
    ...(b.links ?? []).filter((l) => l.type === 'wikipedia').map((l) => l.url),
  ].filter(Boolean);
  const website = (b.links ?? []).find((l) => l.type === 'website')?.url;
  const entity: Ld =
    type === 'DefinedTerm'
      ? {
          '@type': 'DefinedTerm',
          '@id': `${url}#entity`,
          name: b.name,
          termCode: b.id,
          url,
          ...(b.description ? { description: b.description } : {}),
          inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'Internacia international organizations and groupings', url: absolute(path('blocks/')) },
        }
      : {
          '@type': type,
          '@id': `${url}#entity`,
          name: b.name,
          url: website ?? url,
          mainEntityOfPage: url,
          identifier: b.id,
          ...(b.description ? { description: b.description } : {}),
          ...(b.founded ? { foundingDate: b.founded } : {}),
          ...(b.dissolved ? { dissolutionDate: b.dissolved } : {}),
          ...(b.headquarters?.city
            ? { location: { '@type': 'Place', name: [b.headquarters.city, b._hq_country_name].filter(Boolean).join(', ') } }
            : {}),
          ...(b._parents.some((p) => p.exists)
            ? { parentOrganization: b._parents.filter((p) => p.exists).map((p) => ({ '@type': 'Organization', name: p.name, url: absolute(blockPath(p.id)) })) }
            : {}),
          ...(b._children.some((c) => c.exists)
            ? { subOrganization: b._children.filter((c) => c.exists).map((c) => ({ '@type': 'Organization', name: c.name, url: absolute(blockPath(c.id)) })) }
            : {}),
        };
  if (alternateName.length) entity.alternateName = alternateName;
  if (sameAs.length) entity.sameAs = sameAs;

  const members = b._roster.filter((r) => r.current && r.link === 'country');
  return [
    entity,
    {
      '@type': 'ItemList',
      name: `${b._active ? 'Current' : 'Recorded'} member countries of ${b.name}`,
      numberOfItems: members.length,
      itemListElement: members.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: { '@type': 'Country', name: r.name, url: absolute(countryPath(r.id)) },
      })),
    },
  ];
}

export function datasetLd(downloads: { name: string; url: string; format: string | null; bytes: number | null }[]): Ld {
  return {
    '@type': 'Dataset',
    name: 'Internacia Datasets: reference data of countries, intergovernmental organizations, and country groups',
    description:
      'Structured reference data for countries and territories, intergovernmental organizations and country groupings, their block types and membership rosters.',
    url: absolute(path('data/')),
    version: meta.data.version,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    identifier: 'https://doi.org/10.5281/zenodo.20706176',
    creator: { '@type': 'Organization', name: 'Dateno (Common Data Index)', url: 'https://dateno.io' },
    isAccessibleForFree: true,
    dateModified: meta.data.build_date,
    distribution: downloads.map((d) => ({
      '@type': 'DataDownload',
      name: d.name,
      contentUrl: d.url,
      ...(d.format ? { encodingFormat: d.format } : {}),
      ...(d.bytes ? { contentSize: `${d.bytes} B` } : {}),
    })),
  };
}

export const graph = (...nodes: (Ld | Ld[])[]): Ld => ({ '@context': 'https://schema.org', '@graph': nodes.flat() });
