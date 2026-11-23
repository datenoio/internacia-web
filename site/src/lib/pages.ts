// Text of the Data & API, Embeds and About pages, shared by their HTML and Markdown forms.
import { downloads } from './data';
import { bytes } from './format';
import { meta } from './meta';
import { FRAME_HEIGHT, snippets } from './embed';
import { absolute, path, REPO_DATA, REPO_SITE } from './urls';

export const DOI = '10.5281/zenodo.20706176';

export function citation() {
  const year = meta.data.build_date.slice(0, 4);
  const text = `Dateno (Common Data Index). (${year}). Internacia Datasets: reference data of countries, intergovernmental organizations, and country groups (Version ${meta.data.version}) [Data set]. Zenodo. https://doi.org/${DOI}`;
  const bibtex = `@dataset{internacia_${meta.data.version.replace(/\./g, '_')},
  author    = {{Dateno (Common Data Index)}},
  title     = {Internacia Datasets: reference data of countries, intergovernmental organizations, and country groups},
  year      = {${year}},
  version   = {${meta.data.version}},
  publisher = {Zenodo},
  doi       = {${DOI}},
  url       = {https://doi.org/${DOI}}
}`;
  return { text, bibtex };
}

export const recipes = () => {
  const block = absolute(path('api/v1/blocks/ASEAN.json'));
  return [
    {
      title: 'Current member countries of ASEAN with curl and jq',
      code: `curl -s ${block} \\\n  | jq -r '.data._roster[] | select(.current and .type == "country") | [.id, .name, .status] | @tsv'`,
    },
    {
      title: 'Organizations Kenya belongs to, from Markdown',
      code: `curl -s ${absolute(path('countries/ke.md'))}`,
    },
    {
      title: 'The same membership query in DuckDB, against the release file',
      code: `-- internacia.duckdb from ${meta.data.release_url}
SELECT m.country_code, c.name, m.status, m.joined
FROM current_memberships m
JOIN countries c ON c.code = m.country_code
WHERE m.intblock_id = 'ASEAN'
ORDER BY c.name;`,
    },
    {
      title: 'Trade agreements of the Republic of Korea in DuckDB, directly or through a bloc',
      code: `SELECT a.agreement_id, t.name, t.status, a.via
FROM country_trade_agreements a
JOIN trade_agreements t ON t.id = a.agreement_id
WHERE a.country_code = 'KR'
ORDER BY t.status, t.name;`,
    },
  ];
};

export function dataMarkdown(): string {
  const c = citation();
  const files = downloads()
    .map((d) => `| [${d.name}](${d.url}) | ${bytes(d.bytes)} | ${d.sha256 ? `\`${d.sha256}\`` : ''} |`)
    .join('\n');
  return `# Data and API

- Data version: internacia-db v${meta.data.version} (${meta.data.release_url})
- Contract version: ${meta.data.contract_version}
- Built: ${meta.data.build_date}, commit ${meta.data.git_commit}
- Licence: CC-BY-4.0 (country centroids: ODbL-1.0)

## Static JSON API

Base: ${absolute(path('api/v1/'))}. Every document has a \`meta\` object (version, licence, source, links to the HTML and Markdown forms).

- ${absolute(path('api/v1/index.json'))} — entry points and counts
- ${absolute(path('api/v1/countries.json'))} — all countries, lite
- ${absolute(path('api/v1/countries/{CODE}.json'))} — one country with memberships
- ${absolute(path('api/v1/blocks.json'))} — all intblocks, lite
- ${absolute(path('api/v1/blocks/{ID}.json'))} — one intblock with its resolved roster
- ${absolute(path('api/v1/agreements.json'))} — all trade agreements of the registry, lite
- ${absolute(path('api/v1/agreements/{ID}.json'))} — one trade agreement with its parties
- ${absolute(path('api/v1/aliases.json'))} — retired and renamed IDs, and intblock IDs moved to the trade agreements registry
- ${absolute(path('api/v1/search-index.json'))} — names, acronyms and codes in all languages
- ${absolute(path('api/v1/openapi.json'))} — OpenAPI 3.1 description, which links the JSON Schema of every document

## Downloads (GitHub Release ${meta.data.tag})

| File | Size | SHA-256 |
|---|---|---|
${files}

Verify downloads with \`sha256sum -c SHA256SUMS\`.

## Embeds

Membership maps of organizations and membership lists of countries can be shown on other sites: ${absolute(path('embed/'))}

## How to cite

${c.text}

\`\`\`bibtex
${c.bibtex}
\`\`\`

Source code of this site: ${REPO_SITE}. Data repository: ${REPO_DATA}.
`;
}

export function aboutMarkdown(): string {
  return `# About Internacia

Internacia presents internacia-db, an open reference dataset maintained by Dateno, as cards for people and AI agents. The site adds no facts of its own: every value comes from a pinned internacia-db release, and corrections go to ${REPO_DATA}/issues.

## What the data covers

- **Countries and territories**: ISO 3166-1 codes and crosswalks, geography, World Bank classifications, languages, currencies, time zones and other stable reference attributes. Records with non-standard codes exist only where a roster needs a join target; they carry \`code_status\`, \`entity_type\` and \`un_status\` so they are never mistaken for ISO entries.
- **Intblocks**: intergovernmental organizations, treaties and agreements, policy forums, sports federations and named country groupings, with block types, topics and membership rosters (status, joined and left dates).
- **Trade agreements**: a registry of free trade agreements, customs unions, preferential and partial-scope agreements and preference schemes, bilateral ones included, with parties, status, dates and WTO RTA-IS and ADB ARIC IDs. Agreements with three or more parties are also intblocks, which hold their roster. Catalogue-level records come from WTO RTA-IS or ADB ARIC only. The registry has no trade values, tariff lines or depth scores.
- **Not covered**: socioeconomic indicators such as GDP, HDI or government type. Population, area and Gini are reference values with year and source: country cards show them, and the compare explorer adds up population and land area for the selected organizations. No page ranks countries by them.

## Methodology

- Inclusion policy: ${REPO_DATA}/blob/main/docs/intblock-inclusion-policy.md
- Entity classification policy (disputed and non-standard entities): ${REPO_DATA}/blob/main/docs/entity-classification-policy.md
- Country code policy: ${REPO_DATA}/blob/main/docs/country-code-policy.md
- "Current" membership follows internacia-db's \`current_memberships\` view: status not \`former_member\`, no left date, and the organization is neither historical nor dissolved.
- Similar countries and overlapping organizations use the Jaccard index of current memberships, computed at build time.

## Neutrality

The site uses internacia-db's labels and classifications as they are and makes no recognition judgement of its own. Notes on recognition status are shown where the data has them.

## Licence and attribution

- Data: CC BY 4.0, from internacia-db by Dateno. Upstream sources and their terms: ${REPO_DATA}/blob/main/ATTRIBUTION.md
- World Bank classifications and indicators: CC BY 4.0. Wikidata: CC0. GeoNames: CC BY 4.0. IANA tzdata: public domain.
- Country \`centroid\` values come from mledoze/countries and remain under the Open Database License (ODbL) 1.0.
- Site code: MIT, ${REPO_SITE}

## Contact and contributions

Report a data error with the form in internacia-db (${REPO_DATA}/issues/new?template=data_error.yml). Suggestions for the site: ${REPO_SITE}/issues.
`;
}

export function embedMarkdown(): string {
  const map = snippets('block', 'EU', 'European Union (EU)');
  const list = snippets('country', 'FR', 'France');
  return `# Embeds

Two widgets show internacia-db data on other sites. Each widget is a small page on this site: put it in an \`<iframe>\`, or add the \`<internacia-embed>\` element, which sizes the frame to its content. Every widget links to its card and shows the data version and licence.

## Membership map of an organization or grouping

\`${absolute(path('embed/blocks/{id}/'))}\`, with the intblock ID in lowercase. The map colours member countries and territories by status; each one has a tooltip and can be reached with the keyboard. Offered for every intblock whose roster has countries or territories on the map; the card has the code under "Embed this map".

\`\`\`html
${map.iframe}
\`\`\`

## Memberships of a country

\`${absolute(path('embed/countries/{code}/'))}\`, with the ISO 3166-1 alpha-2 code in lowercase. Current memberships, grouped by block type, largest groups first. Offered for every country or territory with current memberships.

\`\`\`html
${list.iframe}
\`\`\`

## Web component

\`\`\`html
${map.component}
\`\`\`

- \`block="ID"\` or \`country="CODE"\` selects the widget.
- \`theme="light"\` or \`theme="dark"\` fixes the colour theme; by default the widget follows the reader's system setting.
- The link inside the element is shown until the script runs, and stays if scripts are blocked.

A plain iframe is ${FRAME_HEIGHT} pixels high by default; change \`height\` to fit your page. For a fixed theme in an iframe, add \`?theme=light\` or \`?theme=dark\` to its URL.

## Attribution

Keep the widget's footer visible. The data are CC BY 4.0 (internacia-db by Dateno); country centroids, used for the dots of small territories, are ODbL 1.0 (mledoze/countries); the base map is Natural Earth (public domain), and its boundaries do not imply endorsement.

## Privacy

Widgets set no cookies, use no storage and load nothing from other hosts. The only message a widget sends to the page around it is its height and title, which the web component uses to size the frame.
`;
}
