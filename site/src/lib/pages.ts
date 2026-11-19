// Text of the Data & API and About pages, shared by their HTML and Markdown forms.
import { downloads } from './data';
import { bytes } from './format';
import { meta } from './meta';
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
- ${absolute(path('api/v1/aliases.json'))} — retired and renamed IDs

## Downloads (GitHub Release ${meta.data.tag})

| File | Size | SHA-256 |
|---|---|---|
${files}

Verify downloads with \`sha256sum -c SHA256SUMS\`.

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
- **Not covered**: socioeconomic indicators such as GDP, HDI or government type. Population, area and Gini appear on country cards as reference values with year and source, without rankings.

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
