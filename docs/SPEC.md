# internacia-web — Technical specification

| | |
|---|---|
| **Status** | Draft 0.1 — for review |
| **Date** | 2026-11-19 |
| **Data baseline** | [internacia-db](https://github.com/datenoio/internacia-db) v3.1.0 (contract 3.1) |
| **Owner** | Dateno ([datenoio](https://github.com/datenoio)) |
| **Hosting** | GitHub Pages, custom domain (to be registered; written as `<DOMAIN>` below) |

## 1. Summary

internacia-web is a static website that presents the contents of internacia-db — countries and
territories, international organizations and country groupings ("intblocks"), their block types,
topics and membership rosters — as browsable cards, indexes and visualizations.

The site has two equal audiences:

- **People** read cards, explore maps and timelines, and compare organizations.
- **Machines** (LLM agents, retrieval pipelines, coding assistants, search engines) read the same
  facts as Markdown, JSON and schema.org structured data at stable URLs.

The site is a read-only view of a pinned internacia-db release. It adds no facts of its own.
All corrections go to internacia-db.

## 2. Goals and non-goals

### 2.1 Goals

1. **Make the product visible.** Anyone can see what internacia-db contains, how complete it is
   and how current it is, without installing anything.
2. **One card per entity.** Every country (256), intblock (1,275), block type (78) and topic
   (153) has its own permanent page.
3. **Answer common questions visually.** Who belongs to X? What does country Y belong to? What do
   X and Z have in common? When were these organizations founded? Where are they based?
4. **Be first-class for AI.** Every page has a Markdown twin and a JSON twin. The site publishes
   `llms.txt`, an OpenAPI description of its static JSON API, and JSON-LD on every page.
5. **Be findable.** Server-rendered HTML, a sitemap, canonical URLs and structured data make
   entity pages rank for queries such as "OSCE member states" or "which organizations is Kenya in".
6. **Stay honest about provenance.** Every page states the data version, links to sources and
   to the record in internacia-db, and carries the CC BY 4.0 attribution.
7. **Cost nothing to run.** Static output only, deployed to GitHub Pages by GitHub Actions.

### 2.2 Non-goals

- Editing data on the site. Edits are pull requests or issues in internacia-db.
- A dynamic API, user accounts, comments or server-side search. The dynamic API is
  [internacia-api](https://github.com/datenoio/internacia-api).
- Adding facts that internacia-db does not hold, in particular socioeconomic indicators (HDI, GDP,
  government type, internet penetration and similar). This is an internacia-db guardrail and the
  site inherits it.
- Rankings or league tables of countries by population, area or Gini. These fields exist in the
  data as reference values. The site shows them on the country card only, with year and source.
- Taking a position on recognition or borders (see [§9.4](#94-neutrality)).

## 3. Audiences and use cases

| Audience | Typical question | Where the site answers it |
|----------|------------------|---------------------------|
| Researcher, journalist, student | "Which countries are members of the African Union, and since when?" | Block card: roster, map, timeline |
| Policy analyst | "What do the EU, NATO and the OECD have in common?" | Compare explorer |
| Data engineer | "What codes does this dataset carry for Kosovo, and how do I join it?" | Country card: identifiers panel, Data & API page |
| Prospective adopter | "How big and how complete is this dataset? Is it maintained?" | Home, Statistics & coverage page |
| LLM agent (browsing or RAG) | "List current members of ASEAN with ISO codes." | `/blocks/asean.md`, `/api/v1/blocks/ASEAN.json` |
| Coding assistant | "Write code that fetches the members of G-20." | `/api/v1/openapi.json`, `llms.txt` |
| Search engine | Entity queries | Server-rendered card, JSON-LD, sitemap |

## 4. Data source and contract

### 4.1 Bundle of record

The site reads **GitHub Release assets** of `datenoio/internacia-db`, never the source YAML and
never a branch. A tagged release is the bundle of record (see internacia-db
[`docs/release-distribution.md`](https://github.com/datenoio/internacia-db/blob/main/docs/release-distribution.md)).

Assets used:

| Asset | Use |
|-------|-----|
| `internacia.duckdb` | Main query source: tables `countries`, `intblocks`, `blocktypes`, `memberships`, `_meta`, alias tables; views `current_memberships`, `country_currencies`, `country_languages`, `country_timezones` |
| `countries.jsonl.zst`, `intblocks.jsonl.zst` | Entity records as cards and JSON twins show them, with every field, including those exported to full JSON only (`suborganizations`, `founding_members`, `membership_applicability`, `notes`, `recognition_status`, `previous_names`, `official_documents`, `social_media`, `secretariat`). Intblock rosters come from `includes[]`: the `memberships` table leaves out organization members |
| `contract.json` | Contract version check, enum values, table schemas |
| `SHA256SUMS` | Integrity check of every downloaded asset |
| `intblocks_aliases.json`, `countries_aliases.json` | Redirect pages for retired or renamed IDs |
| `datapackage.json`, `*.manifest.json` | Version, build identity, file sizes and hashes shown on the Data & API page |

Labels and descriptions for vocabularies are not release assets. The build reads them from the
internacia-db **git tag** that matches the pinned release (sparse checkout of `data/schemas/` and
`data/vocabs/`):

| File | Use |
|------|-----|
| `data/schemas/includes_status.yaml` | Membership status labels, descriptions, deprecations |
| `data/schemas/topics.yaml` | Topic labels |
| `data/vocabs/*.yaml` | Labels for writing systems, legal systems, broadcast systems, rail gauges, DVD regions, writing directions; language codes (`language_codes.yaml`, in releases after v3.1.0) |
| `data/schemas/*.schema.json` | Field descriptions for tooltips and the field glossary |

### 4.2 Pinning

The repository commits a lock file, `internacia.lock.json`:

```json
{
  "repository": "datenoio/internacia-db",
  "tag": "v3.1.0",
  "git_commit": "930121d1b83655ef2fdb4379d8aa506111918dca",
  "contract_major": 3,
  "sha256sums_sha256": "c243b0b2ee0de10436f42b48599f74b00953662cb03bf8d7dfa0e3f9c8b6ac59"
}
```

| Field | Meaning |
|-------|---------|
| `repository`, `tag` | Release to read |
| `git_commit` | Full commit the tag points to; vocabulary files are read at this commit |
| `contract_major` | Contract MAJOR the pipeline supports |
| `sha256sums_sha256` | SHA-256 of the release's `SHA256SUMS` file: anchors every other checksum |

- A build always uses the pinned tag. "Latest" is never resolved at build time.
- A scheduled workflow checks for a newer release and opens a pull request that bumps the pin
  ([§11.3](#113-data-updates)). A person merges it after reviewing the preview build.

### 4.3 Verification

The build fails when any of these checks fails:

1. The SHA-256 of the downloaded `SHA256SUMS` equals `sha256sums_sha256` in the lock file.
2. Every downloaded asset matches its line in `SHA256SUMS`.
3. `contract.json` → `contract_version` has the MAJOR in `contract_major`. A newer MINOR is
   accepted (additive changes).
4. The tag checks out at `git_commit`.
5. In DuckDB `_meta`, every dataset row has `version` equal to the pinned tag without `v`,
   `git_commit` that is a prefix of the pinned commit, the supported contract MAJOR, and
   `row_count` equal to the table's row count. The installed DuckDB is at least `min_duckdb`.
6. Generated page counts equal table row counts (see [§12](#12-quality-assurance-and-acceptance)).

### 4.4 Data rules inherited from internacia-db

These rules come from internacia-db's [`AGENTS.md`](https://github.com/datenoio/internacia-db/blob/main/AGENTS.md)
and [`docs/data-contract.md`](https://github.com/datenoio/internacia-db/blob/main/docs/data-contract.md).
The site's data code must follow them.

- Join membership on `memberships.country_code` / `includes[].id`, never on display names.
- `borders` holds **alpha-3** codes. Resolve them through `countries.iso3code`.
- `population`, `area` and `gini` are structs. Show `.value` with `.year` and `.source`. `year` is
  null when unknown; show "year unknown", never 0.
- 256 country records include 7 non-ISO codes. Every list and count states which set it uses.
  "ISO countries" means `code_status = 'official_iso3166_1'` (249 records).
- Enums are **open**. An unknown enum value is shown as its raw value with a neutral style. It
  never breaks the build.
- "Current members" means the `current_memberships` view. Former members are shown separately,
  never mixed with current ones.
- `memberships.country_code` may reference historical codes (for example `SU`) that have no
  country record. Show the code as plain text without a link.
- Missing World Bank `region` or `incomeLevel` for 8 entities, and missing `adminregion` for
  high-income economies, are by design. Show "not classified by the World Bank", not "missing".
- Aliases with `reason = disambiguated` must not become redirects: the old ID now names a
  different entity. Show a disambiguation page instead.

### 4.5 Baseline figures (v3.1.0)

For sizing only; the site computes all figures at build time.

| Measure | Value |
|---------|------:|
| Country records / ISO 3166-1 entries | 256 / 249 |
| Intblocks | 1,275 |
| Block types / topics | 78 / 153 |
| Membership edges / current / with `joined` date / with `left` date | 59,496 / 58,417 / 17,236 / 333 |
| Intblocks with `founded` / headquarters / `partof` | 1,178 / 875 / 348 |
| Intblocks with Wikidata ID / `last_verified` | 1,104 / 977 |
| Languages in intblock `other_names` | 78 |
| Release assets: `internacia.duckdb` / `intblocks.parquet` / `memberships.parquet` | 4.7 MB / 690 KB / 98 KB |

## 5. Information architecture and URLs

### 5.1 URL scheme

All paths end with a slash for HTML. Machine twins use the same slug with an extension.

| Section | HTML | Markdown | JSON |
|---------|------|----------|------|
| Home | `/` | `/index.md` | `/api/v1/index.json` |
| Countries index | `/countries/` | `/countries.md` | `/api/v1/countries.json` |
| Country card | `/countries/{code}/` | `/countries/{code}.md` | `/api/v1/countries/{CODE}.json` |
| Intblocks index | `/blocks/` | `/blocks.md` | `/api/v1/blocks.json` |
| Intblock card | `/blocks/{id}/` | `/blocks/{id}.md` | `/api/v1/blocks/{ID}.json` |
| Block types | `/types/`, `/types/{key}/` | `/types/{key}.md` | `/api/v1/types/{key}.json` |
| Topics | `/topics/`, `/topics/{key}/` | `/topics/{key}.md` | `/api/v1/topics/{key}.json` |
| Continents, UN M49 subregions | `/geography/`, `/geography/{slug}/` | `/geography/{slug}.md` | `/api/v1/geography/{slug}.json` |
| Explore (visualizations) | `/explore/…` | — | data files under `/api/v1/` |
| Statistics & coverage | `/stats/` | `/stats.md` | `/api/v1/stats.json` |
| Data & API | `/data/` | `/data.md` | `/api/v1/openapi.json` |
| About, methodology, licence | `/about/…` | `/about/{page}.md` | — |
| Search | `/search/?q=` | — | `/api/v1/search-index.json` |
| AI index | — | `/llms.txt`, `/llms-full.txt` | — |

### 5.2 Slug rules

- `{code}`: country alpha-2 code in lowercase (`/countries/fr/`).
- `{id}`: intblock ID in lowercase (`/blocks/nato/`, `/blocks/g-20/`, `/blocks/afcfta/`). IDs use
  letters, digits, `-`, `_` and `+` (`G8+5`; GitHub Pages serves `/blocks/g8+5/` as is). The build
  fails if two IDs collide after lowercasing (none do in v3.1.0).
- JSON paths keep the **exact** ID (`/api/v1/blocks/AfCFTA.json`) so agents can build URLs from
  data without transformation. A lowercase JSON alias is not generated.
- `{key}`: block type or topic key as in the data (snake_case).
- `{slug}` for geography: kebab-case of the label (`south-eastern-asia`).

### 5.3 Stability and redirects

- URLs are permanent. Removing an entity from the data removes its page only through the alias
  mechanism below.
- For every alias in `intblocks_aliases.json` and `countries_aliases.json` (except
  `reason = disambiguated`), the build emits a redirect page at the old HTML URL: an HTML page with
  `<meta http-equiv="refresh">`, `<link rel="canonical">` to the target and a visible link.
  The old JSON URL gets a small JSON document `{"redirect": "<new URL>", "reason": "...", "since": "..."}`.
- GitHub Pages cannot send HTTP 301. This is a known limitation; the canonical link carries the
  signal for search engines.

## 6. Page specifications

Common to every page: header with search, breadcrumb, footer with data version
(`internacia-db vX.Y.Z, built YYYY-MM-DD`), licence line, links "View as Markdown",
"View as JSON", "Source record on GitHub", "Report a data error" (opens the internacia-db issue
template with the entity prefilled).

### 6.1 Home

- One-sentence description of internacia-db and of the site.
- Search box (names in any language, codes, acronyms).
- Key figures: countries, intblocks, block types, topics, membership edges, data version and date.
- World map teaser: number of current memberships per country (links to the map explorer).
- Entry points: browse by block type (treemap or grid), browse by region, featured blocks
  (IDs `UN`, `EU`, `AFUNION`, `ASEAN`, `NATO`, `OECD`, `G-20`, `BRICS`, `COMMONWEALTH`, `OSCE`).
- "For developers and AI" panel: links to Data & API, `llms.txt`, OpenAPI, downloads.

### 6.2 Countries index

- Table of all 256 records with flag, name, alpha-2, alpha-3, continent, UN M49 subregion,
  entity type, UN status, number of current memberships.
- Filters: continent, subregion, World Bank region, entity type, code status, UN status,
  landlocked. Default filter: none. A visible note explains ISO versus non-ISO records.
- Sortable columns. Toggle between table and map view.
- The full table is in the HTML (no client-side fetch needed to see it). Filtering is
  progressive enhancement.

### 6.3 Country card

Sections, in order. A section is omitted when the data has nothing for it.

1. **Header**: flag emoji, `name`, `official_name`, English common name, native names
   (`native_names`: official and common per language), entity type badge, code status badge.
2. **Identifiers**: alpha-2, alpha-3, numeric, M49, Wikidata, GeoNames, IOC, FIFA, FIPS (marked
   legacy), TLD, calling codes. Each value has a copy button. Wikidata and GeoNames link out.
3. **Geography**: continent(s), UN M49 subregion, capital with coordinates, landlocked flag,
   centroid and bounding box on a small locator map, land borders as links to neighbour cards
   (alpha-3 resolved to alpha-2).
4. **Status and classification**: UN status, independence flag, `recognition_status` notes,
   parent entity for dependent territories (link), World Bank region, administrative region,
   income level, lending type — each with the World Bank ID.
5. **Languages and names**: languages (official flag), writing systems and directions, demonyms,
   names in the UN languages (`other_names`), common names.
6. **Practical reference**: currencies (code, name, symbol), time zones, driving side, start of
   week, DVD region, broadcast systems, rail gauges, legal systems. Vocabulary values show their
   labels from `data/vocabs/`.
7. **Reference figures**: population, area, Gini — value, year (or "year unknown") and source.
   No charts, no ranks.
8. **Memberships** (main section):
   - Count of current memberships, with a breakdown by status.
   - Grouped by block type; each row: block name and acronym (link), status label, joined, left.
   - Filter by status and block type; search within the list.
   - Former memberships in a separate, collapsed list.
   - Mini chart: memberships by block type.
9. **Similar countries**: the five countries with the highest Jaccard overlap of current
   memberships, with the overlap figure. Computed at build time.
10. **Provenance**: field-level `provenance` entries (field, source, retrieved date, licence).

### 6.4 Intblocks index

- Table of all 1,275 intblocks: name, acronym, block type(s), status, scope category, geographic
  scope, founded, headquarters country, number of current member countries.
- Filters: block type, status (formal / informal / de-facto / historical), scope category,
  geographic scope, region, topic, founded range, "active only" (default on, with a visible
  toggle). Sortable.

### 6.5 Intblock card

1. **Header**: `name`, acronyms (all languages), status, scope category, geographic scope,
   block type badges (links), topic badges (links), `last_verified` date.
2. **Description**: `description`, `notes`.
3. **Key facts**: founded, dissolved, active period, headquarters (city, country link, small map),
   secretariat, official languages, legal status, recognition status, official
   `membership_count` and `membership_count_type` next to the roster count. A mismatch is shown
   neutrally ("official count: 57; roster lists 56").
4. **Membership map**: world choropleth coloured by status (member, founding member, associate
   member, observer, partner, former member, …). Legend uses labels from `includes_status.yaml`.
   Small or point-like territories are drawn as dots at their centroid.
5. **Roster**: table of every `includes[]` entry — country or intblock (link), status, joined,
   left. Filters by status. Download the roster as CSV and JSON.
   When `membership_applicability = not_applicable`, show the explanation instead of an empty table.
6. **Membership over time** (when at least 30 % of entries have `joined`): step chart of the number
   of members by year, plus an animated map (play button) of accession waves. State how many
   entries lack a date.
7. **Structure**: parent organization(s) (`partof`), suborganizations, predecessor and successor
   chain, previous names with periods.
8. **Overlap**: the five intblocks with the highest overlap of current member countries, with a
   link to the Compare explorer prefilled.
9. **Names**: `other_names` in all languages, grouped by script.
10. **Links**: website, Wikipedia, Wikidata, official documents, social media.
11. **Provenance**.

### 6.6 Block types

- Index: all 78 types with count of intblocks, as a treemap and a table.
- Type page: definition (from the blocktypes record and its `other_names`), list of intblocks of
  this type (same columns as the intblocks index), founding decades histogram for the type.

### 6.7 Topics

- Index: all topics with counts, grouped alphabetically.
- Topic page: label, list of intblocks, related topics (co-occurrence on the same records).

### 6.8 Geography

- Continents and UN M49 subregions: list of countries, map highlight, and the intblocks whose
  `regions` include that area.
- World Bank regions and income groups are intblocks in the data (block type `wbgroup`) and are
  linked from here, not duplicated.

### 6.9 Explore

See [§8](#8-visualizations). Each explorer has a shareable URL with its state in the query string
(for example `/explore/compare/?ids=EU,NATO,OECD`), and a "data behind this chart" table.

### 6.10 Data & API

- Current data version, build date, git commit, contract version, `schema_hash` per table.
- Download links to the pinned GitHub Release assets with size and SHA-256 (from manifests).
- Static JSON API reference generated from `openapi.json`.
- Machine entry points: `llms.txt`, `llms-full.txt`, Markdown twins, sitemap.
- Short recipes: fetch a block's members with `curl` + `jq`; the same query in DuckDB SQL against
  the release Parquet; links to the internacia-db query examples and the Python SDK.
- How to cite: DOI `10.5281/zenodo.20706176` and the version DOI, BibTeX and CSL-JSON.

### 6.11 About

- What internacia-db is, who maintains it, licence (data CC BY 4.0, code MIT), attribution of
  upstream sources (World Bank CC BY 4.0, Wikidata CC0) from internacia-db `ATTRIBUTION.md`.
- Methodology: inclusion policy, entity classification policy, country code policy — summarized
  with links to the internacia-db documents.
- Changelog: data versions the site has published, with links to internacia-db release notes.
- How to contribute or report an error.

### 6.12 Search

- Client-side, no server. Two layers:
  1. **Entity finder** in the header: prefix and fuzzy match over names, `other_names`, native
     names, acronyms and codes of countries and intblocks, in all languages
     (`/api/v1/search-index.json`, budget ≤ 300 KB gzip). Typing "НАТО", "北约" or "OTAN" finds NATO.
  2. **Full-text search** page over all HTML (Pagefind).
- Results show entity type, code or acronym, and the matched name with its language.

### 6.13 Not found

- `404.html` suggests close matches by edit distance over IDs and names (client-side, using the
  search index), so `/blocks/g20/` suggests `/blocks/g-20/`.

## 7. Machine-readable layer

### 7.1 Principles

1. **Same facts, three forms.** HTML, Markdown and JSON for an entity come from the same build
   step and carry the same facts. Tests compare them ([§12](#12-quality-assurance-and-acceptance)).
2. **No facts only in JavaScript.** Every fact is in the server-rendered HTML. Charts enhance the
   page; each has a data table.
3. **Discoverable from any page.** Each HTML page has
   `<link rel="alternate" type="text/markdown" href="….md">` and
   `<link rel="alternate" type="application/json" href="….json">`.
4. **Stable and versioned.** The API path carries a major version (`/api/v1/`). Fields are added,
   never renamed or removed, within v1.
5. **Small enough for a context window.** Index files list sizes and approximate token counts;
   `llms.txt` recommends the smallest file that answers each question.

### 7.2 `llms.txt` and `llms-full.txt`

Follow the [llms.txt](https://llmstxt.org/) format. `/llms.txt` (target ≤ 2,000 tokens) contains:

- what the site and dataset are, licence, data version;
- the guardrails from [§4.4](#44-data-rules-inherited-from-internacia-db) in short form;
- URL patterns for cards and their twins, with examples;
- the JSON API entry points and the OpenAPI link;
- a table "question → smallest resource that answers it";
- links to bulk downloads (GitHub Release) and to internacia-db docs for SQL use.

`/llms-full.txt` adds the Markdown of the About, Methodology and Data & API pages, the field
glossary and the list of all block types and topics with counts.

### 7.3 Markdown twins

- One `.md` per HTML page that shows data. Plain CommonMark with a YAML front matter block:

```markdown
---
type: intblock
id: ASEAN
name: Association of SouthEast Asian Nations
url: https://<DOMAIN>/blocks/asean/
json: https://<DOMAIN>/api/v1/blocks/ASEAN.json
wikidata: Q7768
data_version: 3.1.0
license: CC-BY-4.0
---

# Association of SouthEast Asian Nations (ASEAN)

Formal intergovernmental organization, regional scope. Founded 1967. Headquarters: Jakarta, Indonesia (ID).

## Current members (11)

| Code | Country | Status | Joined |
|------|---------|--------|--------|
| BN | Brunei Darussalam | member | 1984-01-07 |
| ID | Indonesia | member | 1967-08-08 |
| …  | … | … | … |
```

(Abridged. Values in this example come from internacia-db v3.1.0.)

- Tables use codes and IDs next to names so an agent can join without a second lookup.
- Links are absolute URLs.

### 7.4 Static JSON API v1

- Base: `https://<DOMAIN>/api/v1/`. Served as static files with `Content-Type: application/json`.
- Described by `/api/v1/openapi.json` (OpenAPI 3.1). Response bodies have JSON Schemas under
  `/api/v1/schemas/`.
- Every document has a `meta` object:
  `{"data_version": "3.1.0", "contract_version": "3.1", "built_at": "…", "license": "CC-BY-4.0", "source": "https://github.com/datenoio/internacia-db/releases/tag/v3.1.0", "html": "…", "markdown": "…"}`.
  `built_at` is the build time of the data release, so output is reproducible. Country documents
  add `license_notes`: `centroid` values come from mledoze/countries under ODbL-1.0.
- Entity documents have the shape `{"meta": {…}, "data": {…}}`; lists add `count`. The JSON at a
  retired or renamed ID is `{"meta", "redirect", "kind", "reason", "since", "note"}`.

| Endpoint | Contents | Size budget (gzip) |
|----------|----------|-------------------:|
| `index.json` | Entry points, counts, version | 2 KB |
| `countries.json` | Lite list: code, iso3, name, flag, continent, subregion, entity type, code status, UN status, current membership count | 30 KB |
| `countries/{CODE}.json` | Full country record + `memberships` (current and former, with block name and type) + `similar` | 40 KB |
| `blocks.json` | Lite list: id, name, acronyms, block types, status, scope, founded, HQ country, member count | 120 KB |
| `blocks/{ID}.json` | Full intblock record (including full-JSON-only fields) + resolved roster with country names | 60 KB |
| `types.json`, `types/{key}.json` | Block types with counts and member intblock IDs | — |
| `topics.json`, `topics/{key}.json` | Topics with counts and intblock IDs | — |
| `geography/{slug}.json` | Countries and intblocks of an area | — |
| `memberships.json` | All current membership edges `[block_id, country_code, status, joined]` as arrays | 300 KB |
| `stats.json` | Figures behind the Statistics page | 20 KB |
| `search-index.json` | Entity finder index | 300 KB |
| `aliases.json` | Retired and renamed IDs with targets | 2 KB |

Field names and value types inside entity objects are those of internacia-db exports. The site
adds only derived fields, prefixed with `_` (for example `_current_member_count`, `_similar`).

### 7.5 Structured data (JSON-LD)

Every card embeds JSON-LD:

| Page | schema.org type | Key properties |
|------|-----------------|----------------|
| Country | `Country` | `name`, `alternateName`, `identifier` (`PropertyValue` per code), `sameAs` (Wikidata, GeoNames, Wikipedia), `geo`, `containedInPlace`; current memberships as an `ItemList` of `Organization` items |
| Intblock (organization) | `GovernmentOrganization` for IGOs; `Organization` otherwise | `name`, `alternateName`, `foundingDate`, `dissolutionDate`, `location`, `url`, `sameAs`, `parentOrganization`, `subOrganization`; roster as an `ItemList` of `Country` items |
| Intblock (agreement or enumeration) | `DefinedTerm` in a `DefinedTermSet` | `name`, `termCode`, `description` |
| Block type, topic | `DefinedTerm` | `name`, `termCode`, `inDefinedTermSet` |
| Data & API | `Dataset` | `name`, `version`, `license`, `creator`, `distribution` (`DataDownload` per asset), `identifier` (DOI), `temporalCoverage` |
| Every page | `BreadcrumbList` | — |

schema.org has no property that makes a `Place` (such as `Country`) a member of an
`Organization`: `memberOf` and `member` accept only `Organization` and `Person`. Memberships are
therefore published as `ItemList` blocks, not as `memberOf` / `member` statements.

The `Dataset` markup must validate in Google's Rich Results test so the dataset appears in
Google Dataset Search.

### 7.6 Discovery

- `sitemap.xml` (index) with sub-sitemaps per section; `lastmod` is the build date of the data
  release, not the site build time. internacia-db does not publish per-record change dates; when
  it does, `lastmod` switches to them.
- `robots.txt` allows all crawlers, including AI crawlers, and points to the sitemap and
  `llms.txt` (policy confirmed with the owner, see [§15](#15-open-questions)).
- `/feed.xml` (Atom): one entry per published data version, with counts of added, removed and
  changed records.
- Open Graph and Twitter card tags on every page. Cards get a generated social image (name,
  type, small membership map) at build time.

### 7.7 Citation

Every card has a "Cite" button with plain text, BibTeX and CSL-JSON that cite internacia-db
(concept DOI and version) and the card URL with access date.

## 8. Visualizations

All charts are server-rendered to SVG where possible, then made interactive in the browser.
Each chart has a caption, a legend, a "data behind this chart" table and a download of the data
(CSV, JSON). Colour is never the only carrier of meaning.

| # | Name | Where | Data | Form | Interaction |
|---|------|-------|------|------|-------------|
| V1 | Membership map | Block card; `/explore/map/` | `current_memberships` + status | World choropleth by status; dots for small territories | Pick any block; hover shows status and joined date; switch to "former members" |
| V2 | Memberships per country | Home; `/explore/map/?mode=count` | Count of current memberships per country | Choropleth, sequential scale | Filter by block type or scope category; click opens country card |
| V3 | Accession timeline | Block card; `/explore/timeline/` | `joined` / `left` | Step chart of member count; animated map | Play, pause, scrub by year |
| V4 | Founding timeline | `/explore/founded/`; type pages | `founded`, `dissolved` | Histogram by decade, stacked by block type or scope | Brush a period to list intblocks |
| V5 | Headquarters map | `/explore/headquarters/` | `headquarters.coordinates` | Point map with clustering by city | Click a cluster to list organizations |
| V6 | Compare blocks | `/explore/compare/` | Member sets of 2–6 blocks | UpSet chart (Venn for 2–3); map coloured by combination | Add and remove blocks; share URL |
| V7 | Compare countries | `/explore/countries/` | Memberships of 2–4 countries | Shared and exclusive memberships by block type | Add and remove countries |
| V8 | Organization hierarchy | `/explore/hierarchy/`; block card | `partof`, `suborganizations` | Collapsible tree or sunburst (for example the UN system) | Expand, collapse, link to cards |
| V9 | Block type landscape | Home; `/types/` | Intblocks by block type and scope | Treemap | Click a tile to open the type |
| V10 | Statistics & coverage | `/stats/` | Field completeness per table, `last_verified` age | Heatmap of completeness; histogram of verification age; key figures | Link from each cell to the list of records missing that field (in internacia-db terms) |

Base map: Natural Earth admin-0 at 1:110m (and 1:50m where zoom needs it) via the `world-atlas`
TopoJSON, joined on ISO numeric code. Records that do not match a polygon (non-ISO codes, very
small territories) are drawn as dots at `centroid`.

## 9. Design and UX requirements

### 9.1 General

- Responsive from 360 px wide. Cards read well on a phone; tables scroll horizontally with a
  sticky first column.
- Light and dark themes following `prefers-color-scheme`, with a manual switch.
- Typography and colours follow a small design token file. Visual identity is an open question
  ([§15](#15-open-questions)).
- Every value that is a code or ID has a copy button.

### 9.2 Accessibility

- WCAG 2.2 level AA. Automated checks with axe in CI ([§12](#12-quality-assurance-and-acceptance)).
- Full keyboard navigation, visible focus, skip links.
- Every chart has a text summary and a data table. Map regions are focusable and announce name
  and value.
- Categorical palettes are checked for colour-vision deficiency; status on maps also uses
  pattern or outline where categories are adjacent.

### 9.3 Language

- Interface language at launch: English.
- Entity names are always shown in the languages the data has (UN languages for countries;
  up to 78 languages for intblocks), with the right script direction (`dir="rtl"` for Arabic).
- Phase 3 adds interface translations into the other UN languages (Arabic, Chinese, French,
  Russian, Spanish) under `/{lang}/` prefixes with `hreflang` links. Card content then uses the
  localized names from `other_names`; descriptions stay in English until the data has
  translations.

### 9.4 Neutrality

- The site uses the labels and classifications of internacia-db as they are. It adds no
  recognition judgement of its own.
- Cards for entities with `recognition_status` show those notes prominently.
- The About page explains the entity classification policy and that the base map shows
  boundaries as drawn by Natural Earth, which does not imply endorsement.

## 10. Technical architecture

### 10.1 Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Data stage | Python 3.11+, `duckdb`, `zstandard`, `pyyaml` | Same tools and SQL as internacia-db and its documented queries |
| Site generator | [Astro](https://astro.build/) (static output) | Built for content-heavy static sites; ships zero JS by default; islands for interactive charts; generates thousands of pages from JSON quickly |
| Charts | [Observable Plot](https://observablehq.com/plot/) and D3 modules (`d3-geo`, `d3-hierarchy`) | Server-side SVG rendering plus small client islands; already used in internacia-db docs |
| Base map | `world-atlas` TopoJSON (Natural Earth) | Static file, no tile server |
| Full-text search | [Pagefind](https://pagefind.app/) | Static index built after the site; multilingual |
| Entity finder | Small custom index + fuzzy matcher (for example `uFuzzy`) | Multilingual names and acronyms in one ≤ 300 KB file |
| Social images | Satori (HTML/CSS → SVG) and resvg (SVG → PNG) at build time | Per-card Open Graph images without a server |
| Tests | Vitest, Playwright, axe-core, lychee, Lighthouse CI, `jsonschema` | See [§12](#12-quality-assurance-and-acceptance) |

The data stage writes JSON; the site stage reads only that JSON. The site never opens DuckDB.
This keeps the two stages testable on their own.

### 10.2 Repository layout

```text
internacia-web/
├── internacia.lock.json        # pinned internacia-db release (§4.2)
├── pipeline/                   # Python data stage
│   ├── lock.py                 # read and check the lock file
│   ├── fetch.py                # download + verify release assets and vocab files
│   ├── build_data.py           # DuckDB → site JSON (cards, indexes, stats, search index)
│   ├── sql/                    # one .sql file per derived dataset
│   └── tests/
├── site/                       # Astro project
│   ├── site.config.mjs         # SITE_URL and INDEXABLE (§11.2)
│   ├── src/pages/              # routes (§5.1), including .md and .json endpoints
│   ├── src/components/         # cards, tables, chart islands
│   ├── src/content/            # hand-written About and methodology pages
│   └── public/                 # static files, CNAME, robots.txt
├── docs/
│   └── SPEC.md                 # this document
├── .github/workflows/          # build, deploy, data-bump (§11)
├── AGENTS.md
└── README.md
```

Generated data (`.cache/`, `site/src/generated/`) is not committed.

### 10.3 Build pipeline

```text
fetch.py ──► .cache/internacia/v3.1.0/  (assets + vocab files, verified)
   │
build_data.py ──► site/src/generated/*.json  (cards, indexes, stats, search index, aliases)
   │
astro build ──► dist/  (HTML, .md twins, /api/v1/*.json, sitemap, llms.txt, social images)
   │
pagefind --site dist ──► dist/pagefind/
   │
checks (§12) ──► deploy to GitHub Pages
```

- Target build time on GitHub Actions: ≤ 10 minutes.
- Output size target: ≤ 300 MB (GitHub Pages limit is 1 GB).
- The build is reproducible for a given lock file and commit, except timestamps.

### 10.4 Performance budgets

| Measure | Budget |
|---------|--------|
| Card HTML (gzip), without chart islands | ≤ 80 KB |
| JavaScript on a card page before interaction (gzip) | ≤ 60 KB |
| Base map TopoJSON (gzip), loaded lazily | ≤ 120 KB |
| Largest Contentful Paint, mobile, simulated 4G | ≤ 2.5 s |
| Lighthouse (performance, accessibility, best practices, SEO) on sample pages | ≥ 95 each |

## 11. Hosting, domain and deployment

### 11.1 GitHub Pages

- Deploy with `actions/upload-pages-artifact` and `actions/deploy-pages` from the `main` branch.
- Pull requests build the site and upload it as a workflow artifact for review. They do not deploy.
- All actions are pinned to commit SHAs; Dependabot updates them (same practice as internacia-db).
- Workflows use least-privilege `permissions`; only the deploy job has `pages: write` and
  `id-token: write`.

### 11.2 Custom domain

Steps, in order, once the domain is registered:

1. Verify the domain for the `datenoio` organization (Settings → Pages → Verified domains). This
   prevents domain takeover.
2. Create DNS records: for the apex, `A` records `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153` and `AAAA` records `2606:50c0:8000::153` to
   `2606:50c0:8003::153`; for `www`, a `CNAME` to `datenoio.github.io`.
3. Commit `site/public/CNAME` with the domain. In `site/site.config.mjs`, set `SITE_URL` to
   `https://<DOMAIN>/` and `INDEXABLE` to `true`. `SITE_URL` is the only place the domain is
   written; canonical URLs, sitemap, JSON `meta` and `llms.txt` read it.
4. Set the custom domain in repository settings and enable "Enforce HTTPS" when the certificate
   is issued.

Until the domain exists, the site deploys to `https://datenoio.github.io/internacia-web/` with a
`noindex` meta tag, so the temporary URL is not indexed.

### 11.3 Data updates

- `data-bump.yml` runs daily and on manual dispatch. It reads the latest release of
  `datenoio/internacia-db`; if it is newer than the pin, it runs `fetch.py`, updates
  `internacia.lock.json` and opens a pull request with a summary: version, contract version,
  counts added and removed, schema hash changes.
- A new contract MAJOR makes the pull request fail on purpose; the pipeline must be updated first.
- Optional later step: internacia-db's release workflow sends a `repository_dispatch` event so
  the bump happens immediately. This needs a token in internacia-db and is a separate change there.

## 12. Quality assurance and acceptance

The build fails when any of these checks fails.

| Check | Rule |
|-------|------|
| Integrity | [§4.3](#43-verification) checks pass |
| Count parity | Country cards = rows in `countries` (256 in v3.1.0); intblock cards = rows in `intblocks` (1,275); type pages = 78; topic pages = distinct topic keys |
| Roster parity | For every intblock, the number of current members on the card = rows in `current_memberships` for it |
| Twin parity | For a sample of 50 entities (and all featured ones), HTML, Markdown and JSON carry the same codes, names, statuses and dates |
| JSON validity | Every `/api/v1/` file validates against its schema in `/api/v1/schemas/` and against `openapi.json` |
| Links | No broken internal links (lychee, offline mode); external links checked weekly, not on every build |
| Redirects | Every non-disambiguated alias has a redirect page that points to an existing page |
| Accessibility | axe-core finds no serious or critical issues on the sample pages |
| Performance | Lighthouse CI meets [§10.4](#104-performance-budgets) on sample pages |
| Structured data | JSON-LD on sample pages parses and matches the expected types |
| Guardrails | No page or JSON contains fields that internacia-db does not export, except `_`-prefixed derived fields |

Sample pages: `/`, `/countries/fr/`, `/countries/xk/`, `/countries/ps/`, `/countries/aq/`,
`/blocks/un/`, `/blocks/eu/`, `/blocks/nato/`, `/blocks/afunion/`, `/blocks/g-20/`,
`/blocks/afcfta/` (mixed-case ID), `/blocks/jcpoa/` (historical), a block with
`membership_applicability = not_applicable`, `/explore/compare/?ids=EU,NATO,OECD`.

## 13. Milestones

### M0 — Foundations

- Repository scaffold, lock file, `fetch.py` with verification, `build_data.py` skeleton.
- Astro project with layout, theme, header and footer, empty home page.
- CI: build on pull requests, deploy to GitHub Pages on `main` (temporary URL, `noindex`).

**Done when** the pipeline downloads and verifies v3.1.0 and a placeholder page deploys.

### M1 — Cards and machine layer (MVP)

Delivered in two parts. **M1a**: indexes, cards, twins, lite and entity JSON, alias pages,
`llms.txt`, JSON-LD, sitemap, `robots.txt`, Data & API and About pages, and the checks in
`pipeline/check_site.py` (count, roster and twin parity, JSON validity, internal links, redirects,
structured data, guardrails). **M1b**: membership map (V1) and country locator map, entity
finder, 404 suggestions, OpenAPI and JSON Schemas (validated in `check_site.py`), and
`site/scripts/audit.mjs`: axe on 17 sample pages in light and dark themes, Lighthouse on five
(the largest pages included), served with gzip like GitHub Pages.

- Country and intblock indexes and cards ([§6.2](#62-countries-index)–[§6.5](#65-intblock-card)),
  including the membership map (V1) on intblock cards.
- Markdown and JSON twins, `/api/v1/` with OpenAPI and schemas, `llms.txt`, JSON-LD, sitemap,
  `robots.txt`, alias redirects, entity finder, 404 suggestions.
- Data & API and About pages.
- All checks in [§12](#12-quality-assurance-and-acceptance).

**Done when** every country and intblock has an HTML, Markdown and JSON page that pass the
checks, and an LLM agent given only `/llms.txt` can answer "list the current members of ASEAN
with ISO codes" by fetching one file.

### M2 — Explore and browse

Delivered in three parts. **M2a**: block type, topic and geography pages with Markdown and JSON
twins; Statistics & coverage (V10, using internacia-db's completeness gates); the home map of
memberships per country (V2); Atom feed; citation; `data-bump.yml`. **M2b**: explorers V2–V8.
**M2c**: full-text search (Pagefind) and social images.

Decisions taken in M2a: block types are shown as a bar chart, not a treemap (V9), because bars
compare 78 magnitudes more precisely; the feed lists internacia-db releases from the GitHub API,
with record counts for the release the site is built from (per-release diffs are not published);
pull requests opened by `data-bump.yml` with `GITHUB_TOKEN` do not start the Site workflow, so
the bump workflow builds and checks the site itself.

- Block type, topic and geography pages.
- Explorers V2–V10, home page map and treemap, Statistics & coverage page.
- Full-text search (Pagefind), social images, Atom feed, citation button.
- `data-bump.yml`.

**Done when** every explorer works with keyboard only, has a data table, and has a shareable URL.

### M3 — Reach

- Custom domain live with HTTPS; `noindex` removed.
- Interface translations into the UN languages ([§9.3](#93-language)).
- Embeddable widgets: `<iframe>` or web component for "membership map of X" and "memberships of
  country Y", with attribution.
- Optional `repository_dispatch` from internacia-db releases.

## 14. Out of scope

- Any write path to the data.
- Server-side code, databases or paid services.
- Map geometry beyond the Natural Earth world map (no sub-national boundaries).
- Data from sources other than internacia-db.
- Analytics that set cookies or track individuals.

## 15. Open questions

| # | Question | Default until decided |
|---|----------|-----------------------|
| Q1 | Domain name | Temporary `datenoio.github.io/internacia-web/`, `noindex` |
| Q2 | Visual identity: Dateno brand styles or an internacia identity of its own | Neutral design tokens, easy to replace |
| Q3 | Web analytics: none, or a cookie-free counter (for example GoatCounter or Plausible) | None |
| Q4 | AI crawler policy in `robots.txt` | Allow all |
| Q5 | Order of interface languages after English | Russian, French, Spanish, Chinese, Arabic |
| Q6 | Should internacia-db's own docs site (`datenoio.github.io/internacia-db/`) link to or merge into this site | Cross-link from both sides |
| Q7 | Show deprecated status values (`associate`, `associated_observer`) under their replacement label | Show the label from `includes_status.yaml` and mark it deprecated |

## 16. References

- internacia-db repository: <https://github.com/datenoio/internacia-db>
- Agent guide and guardrails: [`AGENTS.md`](https://github.com/datenoio/internacia-db/blob/main/AGENTS.md)
- Data contract: [`docs/data-contract.md`](https://github.com/datenoio/internacia-db/blob/main/docs/data-contract.md)
- Data dictionary: [`docs/data-dictionary.md`](https://github.com/datenoio/internacia-db/blob/main/docs/data-dictionary.md)
- Release distribution: [`docs/release-distribution.md`](https://github.com/datenoio/internacia-db/blob/main/docs/release-distribution.md)
- Entity classification policy: [`docs/entity-classification-policy.md`](https://github.com/datenoio/internacia-db/blob/main/docs/entity-classification-policy.md)
- Intblock inclusion policy: [`docs/intblock-inclusion-policy.md`](https://github.com/datenoio/internacia-db/blob/main/docs/intblock-inclusion-policy.md)
- Concept DOI: <https://doi.org/10.5281/zenodo.20706176>
- llms.txt format: <https://llmstxt.org/>
- GitHub Pages custom domains: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site>
