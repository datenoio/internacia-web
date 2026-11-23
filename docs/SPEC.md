# internacia-web — Technical specification

| | |
|---|---|
| **Status** | Draft 0.1 — for review |
| **Date** | 2026-11-19 |
| **Data baseline** | [internacia-db](https://github.com/datenoio/internacia-db) v5.1.0 (contract 5.1) |
| **Owner** | Dateno ([datenoio](https://github.com/datenoio)) |
| **Hosting** | GitHub Pages, custom domain `internacia.io` (written as `<DOMAIN>` in §11.2); moving to a dedicated server ([§11.4](#114-dedicated-server-ax42)) |

## 1. Summary

internacia-web is a static website that presents the contents of internacia-db — countries and
territories, international organizations and country groupings ("intblocks"), their block types,
topics and membership rosters, and the trade agreements registry (from v5.0.0) — as browsable
cards, indexes and visualizations.

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
2. **One card per entity.** Every country (256), intblock (1,606), trade agreement (5,195), block
   type (83) and topic (154) has its own permanent page.
3. **Answer common questions visually.** Who belongs to X? What does country Y belong to? What do
   X and Z have in common? When were these organizations founded? Where are they based?
4. **Be first-class for AI.** Every page has a Markdown twin and a JSON twin. The site publishes
   `llms.txt`, an OpenAPI description of its static JSON API, and JSON-LD on every page.
5. **Be findable.** Server-rendered HTML, a sitemap, canonical URLs and structured data make
   entity pages rank for queries such as "OSCE member states" or "which organizations is Kenya in".
6. **Stay honest about provenance.** Every page states the data version, links to sources and
   to the record in internacia-db, and carries the CC BY 4.0 attribution.
7. **Cost nothing extra to run.** Static output only, built by GitHub Actions and served as plain
   files: by GitHub Pages, and after the move by a dedicated server the maintainers already run
   for other projects ([§11.4](#114-dedicated-server-ax42)).

### 2.2 Non-goals

- Editing data on the site. Edits are pull requests or issues in internacia-db.
- A dynamic API, user accounts, comments or server-side search. The dynamic API is
  [internacia-api](https://github.com/datenoio/internacia-api).
- Adding facts that internacia-db does not hold, in particular socioeconomic indicators (HDI, GDP,
  government type, internet penetration and similar). This is an internacia-db guardrail and the
  site inherits it.
- Rankings or league tables of countries by population, area or Gini. These fields exist in the
  data as reference values. The country card shows them with year and source; the compare
  explorer (V6) adds up population and land area over the members of the selected intblocks and
  states the years and sources it sums. No page sorts, ranks or colours countries by these values.
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
| `internacia.duckdb` | Main query source: tables `countries`, `intblocks`, `blocktypes`, `memberships`, `border_status` (from v4.1.0), `trade_agreements` and `trade_agreement_parties` (from v5.0.0), `trade_agreement_instruments` (from v5.1.0), `_meta`, alias tables; views `current_memberships`, `country_trade_agreements` (from v5.0.0), `country_currencies`, `country_languages`, `country_timezones`. The trade agreements registry is read from DuckDB: its JSONL exports carry the same columns. The pipeline applies the rule of the `country_borders` view (v4.1.0) to `border_status`, whose rows carry the note, dates and sources, and fails if the result differs from the view. The view runs on DuckDB 1.5.4 (`min_duckdb`) from v4.3.0; before, it needed DuckDB 2.0 |
| `countries.jsonl.zst`, `intblocks.jsonl.zst` | Entity records as cards and JSON twins show them, with every field, including those exported to full JSON only (`suborganizations`, `founding_members`, `membership_applicability`, `notes`, `recognition_status`, `previous_names`, `official_documents`, `social_media`, `secretariat`). Intblock rosters come from `includes[]`: the `memberships` table leaves out organization members |
| `contract.json` | Contract version check, enum values, deprecated enum values (`deprecated[]`), table schemas |
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
| `data/schemas/include_roles.yaml` | Route role labels and descriptions (`includes[].role`, from v4.1.0) |
| `data/schemas/institutional_design.yaml` | Labels and descriptions of the `institutional_design` subfields and values (from v4.1.0) |
| `data/vocabs/*.yaml` | Labels for writing systems, legal systems, broadcast systems, rail gauges, DVD regions, writing directions; language codes (`language_codes.yaml`, from v4.0.0), which also name the languages of the `native_names` keys |
| `data/schemas/*.schema.json` | Field descriptions for tooltips and the field glossary |

### 4.2 Pinning

The repository commits a lock file, `internacia.lock.json`:

```json
{
  "repository": "datenoio/internacia-db",
  "tag": "v5.1.0",
  "git_commit": "e147990effa2a8a789966b485100823652c0d1c9",
  "contract_major": 5,
  "sha256sums_sha256": "bde644290700659e5671e04b817e61bba64ce90bacbf89f133d3c6fa810d34c2"
}
```

| Field | Meaning |
|-------|---------|
| `repository`, `tag` | Release to read |
| `git_commit` | Full commit the tag points to; vocabulary files are read at this commit |
| `contract_major` | Contract MAJOR the pipeline supports: equal to `CONTRACT_MAJOR` in `pipeline/lock.py`, which `bump.py` writes |
| `sha256sums_sha256` | SHA-256 of the release's `SHA256SUMS` file: anchors every other checksum |

- A build always uses the pinned tag. "Latest" is never resolved at build time.
- The pipeline reads one contract MAJOR, `CONTRACT_MAJOR` in `pipeline/lock.py`. A lock file with
  another `contract_major` fails to load; only `bump.py`, which replaces it, reads it anyway.
- A scheduled workflow checks for a newer release and opens a pull request that bumps the pin
  ([§11.3](#113-data-updates)). A person merges it after reviewing the preview build.

### 4.3 Verification

The build fails when any of these checks fails:

1. The SHA-256 of the downloaded `SHA256SUMS` equals `sha256sums_sha256` in the lock file.
2. Every downloaded asset matches its line in `SHA256SUMS`.
3. `contract.json` → `contract_version` has the MAJOR in `contract_major`, which equals the
   pipeline's `CONTRACT_MAJOR`. A newer MINOR is accepted (additive changes). `bump.py update`
   makes the same check, against `SHA256SUMS`, before it moves the lock.
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
- Missing World Bank `region` or `incomeLevel` for 8 entities, and missing `adminregion` for 119
  records (those 8 and the 111 high-income economies), are by design. Show "not classified by the
  World Bank", not "missing".
- `native_names` (contract 4) holds names in the entity's own `languages[]` only, keyed by ISO
  639-1 or, where there is none, ISO 639-3 (`language_codes.yaml` `key`). Either `official` or
  `common` may be null; an entry with neither is not shown. English names come from `name` and
  `official_name`, names in the UN languages from `other_names`. Never look up `native_names['en']`.
- `includes[].name` of a `type: country` entry is the country's `name` (contract 4: the export
  fills it; it is optional in the source).
- Deprecated include statuses (`associate`, `associated_observer`; `contract.json` `deprecated[]`,
  `deprecated` in `includes_status.yaml`) stay valid until a MAJOR removes them; contract 5.0
  still lists them (`removal: next MAJOR`). Card membership and roster tables and their Markdown
  twins show the status's own label with a "deprecated label" note; never remap them to a
  replacement. No record uses them from v4.3.0, where internacia-db finished its review of
  associate statuses; the handling stays until a MAJOR removes them.
- Deprecated block types (`intorg` from v4.1.0; `eccurr` and `cuscurr` from v4.4.0; `deprecated`
  in the `blocktypes` table) stay on their records until a MAJOR removes them (contract 5.0 keeps
  all three). Cards and type pages mark
  them deprecated; the type page shows the deprecation note and links the replacements.
  Intergovernmental organizations are selected by `scope_category = 'igo'`, never by block type. A
  block type never combines two others: `eccurr` is `economic` with `currency`, `cuscurr` is
  `customs` with `currency`.
- Records whose primary block type is `currency` (v4.4.0) are currency unions with the roster of
  countries that use the currency (`EUROAREA`, `ECCU`), including dissolved unions and currency
  boards (`LMU`, `EACB`, status `historical`). `currency` as a secondary type also marks
  organizations whose treaties establish the currency (`UEMOA`, `OECS`) and central banks (`ECB`).
  The site does not present a secondary `currency` tag as a currency roster.
- `includes[].role` (v4.1.0) is set only on pipelines and corridors: `origin`, `transit`,
  `destination`, `terminal` (open enum, labels from `include_roles.yaml`). It says what a country does
  on the route; `status` still says how it relates to the record. Rosters, country membership
  tables, their Markdown twins and the roster CSV show it in a column that appears only when used.
- `institutional_design` (v4.1.0) is optional: an absent object or subfield means unknown, never
  "none". `none` in `independent_organs` or `enforcement` is a value and is shown. `veto_holders`
  are country alpha-2 codes.
- `border_status` (v4.1.0) lists recorded closures and restrictions of land borders, one row per
  pair of alpha-3 codes. A row without `until` is current (the `country_borders` view's rule; the pipeline checks its
  result against the view). No
  row means no closure is recorded, not that the border is verified open; the card says so.
  Evidence limit (documented from v4.2.0): most rows rest on official travel advice, which
  describes crossings for travellers, so a `closed` border can still carry some freight. The card
  and its Markdown twin say so in the same words (`BORDER_EVIDENCE_NOTE`, `lib/design.ts`).
- Aliases with `reason = disambiguated` must not become redirects: the old ID now names a
  different entity. Show a disambiguation page instead.
- Trade agreements registry (v5.0.0): one `trade_agreements` row per agreement, bilateral ones
  included, with `agreement_type`, `status`, `signed`, `in_force`, `ended`, `wto_rta_id`,
  `aric_id`, `verification` and provenance; parties in `trade_agreement_parties`. It holds no
  trade values, tariff lines or depth scores, and the site adds none.
- Contract 5.1 (v5.1.0) widens the registry: `agreement_type` `investment` (bilateral and
  plurilateral investment treaties, IDs ending in `-BIT`) and `trade_relations` (most-favoured-nation
  treatment without preferences, `-TRA`), and `services` now means services only; `status`
  `suspended` (negotiations on hold, not ended); `in_force` is the definitive entry into force and
  `provisional_application` the date provisional application began (an agreement applied only
  provisionally has `status = in_force` and no `in_force`); parties of a preference scheme have the
  `role` grantor or beneficiary (`party` on every other agreement); `parent` links a sub-scheme to
  its scheme (`GSP` → `EU-GSP` → `EU-GSP-EBA`); more catalogue IDs (`wto_pta_ids`, `gptad_id`,
  `dta_id`, `unctad_iia_id`, `unts_registration`), shown as codes, because the records link the
  catalogue pages themselves; a `treaty_text` link type; and the `trade_agreement_instruments`
  table (protocols, supplements, early harvests, joint committee decisions), which never changes
  the agreement's own row. Following internacia-db's consumer guide, cards count investment
  treaties, trade relations agreements and preference schemes apart from trade agreements, and
  show "applies since" as `provisional_application` when there is no `in_force`. A record with `intblock_id`
  (an agreement with three or more parties, such as `RCEP`) reads its parties from that
  intblock's `includes` (`source = intblock`), under the same ID; the card links the two.
- A country's trade agreements are the `country_trade_agreements` view: one row per agreement it
  is a current party to, directly or through a bloc party (the EU) expanded to the bloc's current
  members, with `via` set to the bloc. Coverage is current, not historical; the card says so.
  `former_party` rows of the country itself are listed apart.
- `verification = catalogue` records come from a catalogue only (WTO RTA-IS, the WTO PTA Database,
  ADB ARIC, GPTAD, the UNCTAD IIA Navigator, EDIT or the UN Treaty Series; before v5.1.0 WTO RTA-IS
  or ADB ARIC): catalogue statuses can lag and ARIC lists only ADB-member parties. Cards and twins say so in the same words
  (`CATALOGUE_NOTE`, `lib/agreements.ts`). A `preference_scheme` (GSP, AGOA) lists grantors and
  beneficiaries as parties; two grantors are not partners under it.
- Aliases with `reason = moved` and `target_dataset = trade_agreements` (v5.0.0: 34 two-party
  agreements such as `USKR`, `CETA`, `EUJP`) left `intblocks` and `memberships` for the registry,
  under the same ID. Their old intblock URLs redirect to the agreement card, and the card notes the
  former record.

### 4.5 Baseline figures (v5.1.0)

For sizing only; the site computes all figures at build time.

| Measure | Value |
|---------|------:|
| Country records / ISO 3166-1 entries | 256 / 249 |
| Intblocks | 1,606 |
| Block types (deprecated) / topics | 83 (3) / 154 |
| Membership edges / current / with `joined` date / with `left` date | 73,101 / 71,734 / 32,411 / 486 |
| Membership edges with a route `role` / intblocks with roles | 125 / 44 |
| Intblocks with `founded` / headquarters / `partof` | 1,495 / 1,031 / 399 |
| Intblocks with Wikidata ID / `last_verified` / `institutional_design` | 1,324 / 1,543 / 112 |
| `border_status` rows | 18 |
| Trade agreements / in force / two parties / linked to an intblock / `official` | 5,195 / 3,195 / 4,827 / 99 / 1,109 |
| Of them investment treaties / trade relations agreements / preference schemes / `suspended` | 3,503 / 369 / 59 / 6 |
| With `provisional_application` (no `in_force`) / instruments (agreements with any) | 30 (13) / 141 (51) |
| `trade_agreement_parties` rows / `country_trade_agreements` rows / countries | 15,481 / 19,172 / 238 |
| Languages in intblock `other_names` | 82 |
| Country `native_names` entries / languages | 388 / 126 |
| Release assets: `internacia.duckdb` / `intblocks.parquet` / `memberships.parquet` | 8.7 MB / 955 KB / 154 KB |

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
| Trade agreements index | `/agreements/` | `/agreements.md` | `/api/v1/agreements.json` |
| Trade agreement card | `/agreements/{id}/` | `/agreements/{id}.md` | `/api/v1/agreements/{ID}.json` |
| Block types | `/types/`, `/types/{key}/` | `/types/{key}.md` | `/api/v1/types/{key}.json` |
| Topics | `/topics/`, `/topics/{key}/` | `/topics/{key}.md` | `/api/v1/topics/{key}.json` |
| Continents, UN M49 subregions | `/geography/`, `/geography/{slug}/` | `/geography/{slug}.md` | `/api/v1/geography/{slug}.json` |
| Explore (visualizations) | `/explore/…` | — | data files under `/api/v1/` |
| Statistics & coverage | `/stats/` | `/stats.md` | `/api/v1/stats.json` |
| Data & API | `/data/` | `/data.md` | `/api/v1/openapi.json` |
| About, methodology, licence | `/about/…` | `/about/{page}.md` | — |
| Search | `/search/?q=` | — | `/api/v1/search-index.json` |
| Embeds (widgets for other sites) | `/embed/`, `/embed/blocks/{id}/`, `/embed/countries/{code}/` | `/embed.md` | — |
| AI index | — | `/llms.txt`, `/llms-full.txt` | — |

### 5.2 Slug rules

- `{code}`: country alpha-2 code in lowercase (`/countries/fr/`).
- `{id}`: intblock ID in lowercase (`/blocks/nato/`, `/blocks/g-20/`, `/blocks/afcfta/`). IDs use
  letters, digits, `-`, `_` and `+` (`G8+5`; GitHub Pages serves `/blocks/g8+5/` as is). The build
  fails if two IDs collide after lowercasing (none do in v5.0.0). Trade agreement IDs (`{id}` under
  `/agreements/`) follow the same rules; a record linked to an intblock has the intblock's ID.
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
- An intblock alias with `reason = moved` and `target_dataset = trade_agreements` (v5.0.0) redirects
  to the trade agreement card of the same ID (`/blocks/uskr/` → `/agreements/uskr/`); its JSON
  alias document names the agreement document.
- GitHub Pages cannot send HTTP 301. This is a known limitation; the canonical link carries the
  signal for search engines. The dedicated server ([§11.4](#114-dedicated-server-ax42)) could send
  301; the redirect pages stay until its configuration takes the aliases over.

## 6. Page specifications

Common to every page: header with search, breadcrumb, footer with data version
(`internacia-db vX.Y.Z, built YYYY-MM-DD`), licence line, links "View as Markdown",
"View as JSON", "Source record on GitHub", "Report a data error" (opens the internacia-db issue
template with the entity prefilled).

### 6.1 Home

- One-sentence description of internacia-db and of the site.
- Search box (names in any language, codes, acronyms), with example questions under it as plain
  links into cards, lists and explorers (for example "Compare EU, NATO and OECD").
- The explorers as tiles with a small drawing of each view.
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

Sections, in order. A section is omitted when the data has nothing for it. Memberships, the main
section, come right after the header; the reference sections follow. A row of section links under
the header sticks to the top of the window (also on the intblock card).

1. **Header**: flag emoji, `name`, `official_name`, entity type badge, code status badge. Native
   names (`native_names`: official and common in each of the entity's own languages, with the
   language name) are listed under Languages and names.
2. **Memberships** (main section):
   - Count of current memberships, with a breakdown by status.
   - Grouped by block type; each row: block name and acronym (link; the ID only where it differs
     from the acronym), status label, route role (pipelines and corridors; the column appears only
     when used), joined, left. Under the table, the definitions of the statuses it uses (from
     `includes_status.yaml`), which are also each status cell's tooltip.
   - Filter by status and block type; search within the list.
   - Former memberships in a separate, collapsed list.
   - Mini chart: memberships by block type.
3. **Trade agreements** (v5.0.0): the agreements of the `country_trade_agreements` view, in force
   first — agreement (link), type, status, in-force date, and "via" with the bloc (link) when the
   country is covered through a bloc party. Search and status filter. The section states that
   coverage is current and includes every agreement status; the country's own `former_party`
   entries follow in a collapsed list. With no rows the section says the registry records none.
   From v5.1.0 the summary counts each kind apart (trade agreements, investment treaties, trade
   relations agreements, preference schemes as beneficiary or as grantor), a "Kind" filter selects
   one, and "Role" and "Provisional application" columns appear when a row has one.
4. **Similar countries**: the five countries with the highest Jaccard overlap of current
   memberships, with the overlap figure. Computed at build time.
5. **Identifiers**: alpha-2, alpha-3, numeric, M49, Wikidata, GeoNames, IOC, FIFA, FIPS (marked
   legacy), TLD, calling codes. Each value has a copy button. Wikidata and GeoNames link out.
6. **Geography**: continent(s), UN M49 subregion, capital with coordinates, landlocked flag,
   centroid and bounding box on a small locator map, land borders as links to neighbour cards
   (alpha-3 resolved to alpha-2). A border with a `border_status` row shows its status and period
   next to the link, and a list below gives the note, sources and verification date, with the
   statement that a border without a status has no recorded closure (not that it is open).
7. **Status and classification**: UN status, independence flag, `recognition_status` notes,
   parent entity for dependent territories (link), World Bank region, administrative region,
   income level, lending type — each with the World Bank ID.
8. **Practical reference**: currencies (code, name, symbol), time zones, driving side, start of
   week, DVD region, broadcast systems, rail gauges, legal systems. Vocabulary values show their
   labels from `data/vocabs/`.
9. **Languages and names**: languages (official flag), writing systems and directions, demonyms,
   names in the UN languages (`other_names`), common names.
10. **Reference figures**: population, area, Gini — value, year (or "year unknown") and source.
   No charts, no ranks.
11. **Provenance**: field-level `provenance` entries (field, source, retrieved date, licence).

### 6.4 Intblocks index

- Table of all 1,581 intblocks: name, acronym, block type(s), status, scope category, geographic
  scope, founded, headquarters country, number of current member countries.
- Filters: block type, status (formal / informal / de-facto / historical), scope category,
  geographic scope, region, topic, founded range, "active only" (default on, with a visible
  toggle). Sortable.
- The filters are facets in a side panel (a modal sheet on narrow screens): values of one facet
  combine with OR, facets with AND, and each value shows how many rows it would add given the
  other filters. Long facets show their largest values and have a filter field. Active filters
  repeat as removable chips; the state is in the query string. On a phone the rows read as cards.

### 6.5 Intblock card

1. **Header**: `name`, acronyms (all languages), status, scope category, geographic scope,
   block type badges (links), topic badges (links), `last_verified` date.
2. **Description**: `description`, `notes`.
3. **Key facts**: founded, dissolved, active period, headquarters (city, country link, small map),
   secretariat, official languages, legal status, recognition status, official
   `membership_count` and `membership_count_type` next to the roster count. A mismatch is shown
   neutrally ("official count: 57; roster lists 56"). An intblock with a trade agreements registry
   record (v5.0.0, `intblock_id`) links to its agreement card, with its status.
4. **Membership map**: world choropleth coloured by status (member, founding member, associate
   member, observer, partner, former member, …). Legend uses labels from `includes_status.yaml`.
   Small or point-like territories are drawn as dots at their centroid.
5. **Roster**: table of every `includes[]` entry — country or intblock (link), status, route role
   (pipelines and corridors; the column appears only when used), joined, left. Filters by status.
   Under the table, the definitions of the statuses it uses, also each status cell's tooltip. Download the roster as CSV (`/blocks/{id}/members.csv`, every entry
   with a `current` column) and JSON (the card's JSON, `_roster`). Hovering a row highlights its
   country on the map, and the other way round.
   When `membership_applicability = not_applicable`, show the explanation instead of an empty table.
6. **Membership over time** (when at least 30 % of entries have `joined`): step chart of the number
   of members by year, plus an animated map (play button) of accession waves. State how many
   entries lack a date.
7. **Structure**: parent organization(s) (`partof`), suborganizations, predecessor and successor
   chain, previous names with periods.
   Next to it, **Institutional design** (when `institutional_design` is set): mandate, decision
   rule, decision force, independent organs, enforcement, mutual defence, veto holders (links to
   country cards), with labels and descriptions from `institutional_design.yaml`. Absent subfields
   are unknown and left out; the section says so.
8. **Trade agreements** (v5.0.0, blocs that are parties such as the EU, EAEU, MERCOSUR): the
   agreements the intblock is a party to, with type, status and in-force date (role and
   provisional application from v5.1.0, when a row has one), counted by kind. Its current members
   are covered through it ("via").
9. **Overlap**: the five intblocks with the highest overlap of current member countries, with a
   link to the Compare explorer prefilled.
10. **Names**: `other_names` in all languages, grouped by script.
11. **Links**: website, Wikipedia, Wikidata, official documents, social media.
12. **Provenance**.

### 6.6 Block types

- Index: all 83 types with count of intblocks and scope note, as a treemap and a table; deprecated
  types are marked.
- Type page: definition (from the blocktypes record: `description`, the scope note, and
  `other_names`), a notice when the type is deprecated (`deprecated`: removal and note), list of
  intblocks of this type (same columns as the intblocks index), founding decades histogram for the
  type.

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

- Every explorer picks organizations and countries with the same picker: the finder's search
  (names in any language, acronyms, codes) limited to one kind of entity. Chips of the chosen
  entities show their names, not their codes.
- Explorer maps zoom to the coloured countries, as on the cards (V1), with a switch to the whole
  world. In the header, `/` focuses the finder.

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
     names, acronyms and codes of countries, intblocks and trade agreements, in all languages
     (`/api/v1/search-index.json`, budget ≤ 300 KB gzip). Typing "НАТО", "北约" or "OTAN" finds NATO.
     Investment treaties (v5.1.0: 3,503 records) are left out: with them the index is about
     360 KB gzip, without them about 280 KB. Full-text search and the country cards list them.
  2. **Full-text search** page over all HTML (Pagefind).
- Results show entity type, code or acronym, and the matched name with its language.

### 6.13 Not found

- `404.html` suggests close matches by edit distance over IDs and names (client-side, using the
  search index), so `/blocks/g20/` suggests `/blocks/g-20/`.

### 6.14 Trade agreements (v5.0.0, contract 5.1 from v5.1.0)

- **Index** (`/agreements/`): a one-line lead; four headline figures (records, in force,
  investment treaties, checked against official sources; "with two parties" until v5.1.0, when
  investment treaties made nearly every record bilateral), each a link to the list it counts; the registry's
  scope note and the share of catalogue records in a collapsed "About the registry"; then the list,
  and below it the counts by status and by type (bars with their values as text, each a link to the
  list with that filter). The list is a table of all 5,195 agreements — name and acronym (link, with
  an "Official sources" badge on the records checked against them), type, status (badge: in force
  filled; terminated, superseded and abandoned marked, as on the card), signed, in force, ended
  ("—" when not recorded), number of parties. An agreement applied only provisionally shows the
  date of provisional application in the "In force" column, marked "provisional". Rows are in force first, then newest first by the
  latest date recorded; empty cells sort last. The ID is not shown, but the search matches it.
  Search and facets as on the intblocks index (§6.4): countries covered, status, type, number of
  parties (two, three or more) and verification. "Countries covered" follows the
  `country_trade_agreements` view (a bloc party counts its current members) and, unlike the other
  facets, combines its values with AND: two checked countries show the agreements that cover both.
  Rows are chunked (`content-visibility`); on a phone they read as cards. The rows carry no filter
  values: the script loads them from `/agreements/facets.json` (path, ID, countries covered,
  status, type, parties, verification) when the reader first reaches for the search or the
  filters, so the page stays within its HTML budget ([§10.4](#104-performance-budgets)). The file
  holds no fact the table, the cards and their twins do not show, and it is not part of the API.
- **Card** (`/agreements/{id}/`), in order:
  1. Header: name and acronym; badges for status, type and verification level; `description`;
     the catalogue notice for `verification = catalogue`; "Cite"; a note when the ID was an
     intblock before v5.0.0 (`moved` alias).
  2. Key facts: ID, type, status, signed, provisional application, in force, ended, number of
     parties (and former), WTO RTA ID and ADB ARIC ID (links to the catalogues), WTO PTA Database
     IDs, GPTAD ID, World Bank DTA ID, UNCTAD IIA Navigator ID and UN Treaty Series registration
     (codes; the records' links lead to those catalogues), Wikidata, verification,
     `last_verified`, the note that tells provisional application from entry into force (when the
     record has one), and the registry's scope note (no trade values, tariff lines or depth scores).
  3. Related records: the intblock that holds the roster (link), the records this one supersedes
     (its `supersedes` and every record whose `superseded_by` names it), its successor, the scheme
     it is part of (`parent`) and the schemes under it.
  4. Notes (`notes`; IDs in backticks link to agreement or intblock cards).
  5. Parties: name (link to the country or intblock card), code, type, role (grantor or
     beneficiary), signed, provisional application, in force, joined (columns appear when used);
     former parties in a collapsed list. Preference schemes carry the grantor note.
  6. Countries covered (when a party is a bloc): the view's rows with "via" (and role).
  7. Instruments (`trade_agreement_instruments`): name with notes, kind, status, signed, in force,
     ended, coverage.
  8. Names, links, provenance. Provenance lists each source once with the fields it gives (a
     catalogue record cites one page for parties, status and dates); the JSON twin keeps the rows.
- No map and no per-card social image: a linked intblock card has the map, and two-party
  agreements gain little from one. The Markdown twin has the same facts and tables; the JSON twin
  is the registry row with `_` fields (`_parties`, `_countries`, `_block`, `_supersedes`,
  `_superseded_by`, `_parent`, `_children`, `_instruments`, `_alias_notes`).

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
  `{"data_version": "5.0.0", "contract_version": "5.0", "built_at": "…", "license": "CC-BY-4.0", "source": "https://github.com/datenoio/internacia-db/releases/tag/v5.0.0", "html": "…", "markdown": "…"}`.
  `built_at` is the build time of the data release, so output is reproducible. Country documents
  add `license_notes`: `centroid` values come from mledoze/countries under ODbL-1.0.
- Entity documents have the shape `{"meta": {…}, "data": {…}}`; lists add `count`. The JSON at a
  retired or renamed ID is `{"meta", "redirect", "kind", "reason", "since", "note"}`.

| Endpoint | Contents | Size budget (gzip) |
|----------|----------|-------------------:|
| `index.json` | Entry points, counts, version | 2 KB |
| `countries.json` | Lite list: code, iso3, name, flag, continent, subregion, entity type, code status, UN status, population and land area (value, year, source), current membership count | 30 KB |
| `countries/{CODE}.json` | Full country record + `memberships` (current and former, with block name and type) + `similar` | 40 KB |
| `blocks.json` | Lite list: id, name, acronyms, block types, status, scope, founded, HQ country, member count | 120 KB |
| `blocks/{ID}.json` | Full intblock record (including full-JSON-only fields) + resolved roster with country names | 60 KB |
| `agreements.json` | Lite list of the trade agreements registry: id, name, acronym, type, status, dates (provisional application included), intblock, parent scheme, WTO RTA and ADB ARIC IDs, verification, party count | 1.8 MB (5,195 records) |
| `agreements/{ID}.json` | Registry row + resolved parties (with role) + countries covered (bloc parties expanded) + related records + instruments | 4 KB (most are two-party investment treaties) |
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
| Trade agreement (v5.0.0) | `Legislation` | `name`, `alternateName`, `identifier`, `sameAs`, `description`, `legislationDate` (signed), `legislationLegalForce` (`InForce` for in force, `NotInForce` for terminated or superseded, else omitted); parties as an `ItemList` |
| Block type, topic | `DefinedTerm` | `name`, `termCode`, `inDefinedTermSet` |
| Data & API | `Dataset` | `name`, `version`, `license`, `creator`, `distribution` (`DataDownload` per asset), `identifier` (DOI), `temporalCoverage` |
| Every page | `BreadcrumbList` | — |

schema.org has no property that makes a `Place` (such as `Country`) a member of an
`Organization`: `memberOf` and `member` accept only `Organization` and `Person`. Memberships are
therefore published as `ItemList` blocks, not as `memberOf` / `member` statements. The items of
these lists are the `Organization`, `Country` or other entities themselves (`itemListElement`
accepts a `Thing`), without a `ListItem` and `position` around each: the lists are unordered, and
the wrapper was a quarter of the JSON-LD bytes (§10.3). `BreadcrumbList` keeps its `ListItem`s.

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
| V1 | Membership map | Block card; `/explore/map/` | `current_memberships` + status | World choropleth by status; dots for small territories; zoomed to the members when they cover part of the world, with a switch to the whole world | Pick any block; hover shows status and joined date; switch to "former members" |
| V2 | Memberships per country | Home; `/explore/map/?mode=count` | Count of current memberships per country | Choropleth, sequential scale | Filter by block type or scope category; click opens country card |
| V3 | Accession timeline | Block card; `/explore/timeline/` | `joined` / `left` | Step chart of member count; animated map, side by side on wide screens | Play, pause, scrub by year |
| V4 | Founding timeline | `/explore/founded/`; type pages | `founded`, `dissolved` | Histogram by decade, stacked by block type or scope | Brush a period to list intblocks |
| V5 | Headquarters map | `/explore/headquarters/` | `headquarters.coordinates` | Point map with clustering by city | Click a cluster to list its organizations by block type in a panel beside the map (`?city=`) |
| V6 | Compare blocks | `/explore/compare/` | Member sets of 2–6 blocks; population and land area of the members; continents; World Bank income groups (`wbgroup` intblocks) | Profiles side by side; UpSet chart counted in countries, population or land area; overlap map (by combination for 2 blocks, by count for 3–6) and, for 3–6, a small map per block; pairwise overlap matrix; composition by continent and by income group | Add and remove blocks; pick the measure; members only; pick a combination to show it alone on the map and in the table; share URL |
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
  sticky first column. A long table scrolls inside a panel of at most three quarters of the screen
  height, with a sticky header row; columns that are empty or the same in every row are left out.
- The header keeps the finder and the main sections (Countries, Organizations, Explore, Data & API)
  on one row; the other pages are under "More", and on narrow screens every section is in one
  "Menu". Coloured regions of a map link to the country cards.
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
| Social images | Hand-written SVG, resvg (SVG → PNG) and sharp (palette PNG) at build time | Per-card Open Graph images without a server |
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
├── deploy/ax42/                # dedicated server: receive script, setup, Caddy config (§11.4)
├── AGENTS.md
└── README.md
```

Generated data (`.cache/`, `site/src/generated/`) is not committed.

### 10.3 Build pipeline

```text
fetch.py ──► .cache/internacia/v5.1.0/  (assets + vocab files, verified)
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
- Output size target: ≤ 450 MB (GitHub Pages limit is 1 GB; it holds while Pages is the host or
  the fallback, [§11.4](#114-dedicated-server-ax42)); it was ≤ 300 MB until v5.1.0. With
  v5.1.0 the site is about 427 MB (`du -sh site/dist`; 356 MB of file content): trade agreement
  cards 92 MB, API 88 MB, blocks 84 MB, countries 53 MB, social images 45 MB, Pagefind 32 MB,
  widgets 21 MB. The trade agreements registry grew from 839 to 5,195 records (3,503 investment
  treaties), and one card per record (§1, goal 2) cannot stay under 300 MB: a small agreement card
  is about 11.6 KB, of which the shared layout is about 6.5 KB, and each card with its Markdown twin
  takes 16 KB on disk. Grouping provenance by source is the one trim made with v5.1.0. The target
  was raised rather than leaving cards out; M3b must still plan its size before adding languages.
  With v5.0.0 the site was about 294 MB
  (`du -sh site/dist`; 263 MB of file content): blocks 83 MB, API 60 MB, social images 45 MB,
  countries 46 MB, widgets 21 MB, trade agreement cards 16 MB, Pagefind 14 MB. The trade
  agreements registry (839 cards with Markdown twins, their JSON, and the trade agreement sections
  of country cards) added about 30 MB and took the site to 313 MB (283 MB of file content); four
  repeats brought it back under the target, about 20 MB in all, with the same pages and facts.
  A title with the status definition on every membership row (about 10 MB: "Full member state or
  participant…" 134,000 times) became one list of definitions under each table, which
  `scripts/site.ts` copies to the cells as tooltips. The `ListItem` around each JSON-LD list item
  (about 6 MB, §7.5) is gone. The theme icons are CSS masks instead of three inline SVGs, and the
  first-paint script is compact (about 3 MB); the citation's CSL-JSON is one property per line,
  without `&quot;` escapes in `<pre>`. The shared layout of a small card (head, header, footer and
  citation) is about 7 KB of its 11 KB. With v4.4.0 the site was about 272 MB
  (248 MB of file content). It had grown above the target by data alone
  (322 MB with v4.3.0, 375 MB with v4.4.0: 1,538 intblocks, 69,191 membership edges), not by new
  kinds of pages. Template indentation was 84 MB of the HTML and JSON indentation 25 MB of the
  API, so the build removes both: `site/scripts/trim-html.mjs` turns each whitespace run with a
  line break in text into one line break (the page renders the same; `<pre>`, `<textarea>`,
  `<script>` and `<style>` are kept as they are), and lists and per-entity documents are written
  without indentation (the index, OpenAPI description, schemas and aliases stay indented).
- The build is reproducible for a given lock file and commit, except timestamps.

### 10.4 Performance budgets

| Measure | Budget |
|---------|--------|
| Card HTML (gzip), without chart islands | ≤ 80 KB |
| Trade agreements index HTML (gzip), the largest page | ≤ 180 KB |
| JavaScript on a card page before interaction (gzip) | ≤ 60 KB |
| Base map TopoJSON (gzip), loaded lazily | ≤ 120 KB |
| Largest Contentful Paint, mobile, simulated 4G | ≤ 2.5 s |
| Lighthouse (performance, accessibility, best practices, SEO) on sample pages | ≥ 95 each |

## 11. Hosting, domain and deployment

### 11.1 GitHub Pages

Pages serves the site until DNS moves to the dedicated server of [§11.4](#114-dedicated-server-ax42),
and stays the fallback after.

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

The domain is `internacia.io` (steps 2 and 3 done in November 2026). GitHub Pages redirects the
former address `https://datenoio.github.io/internacia-web/` to it, path included, so old links
keep working. Until the domain existed, the site deployed there with a `noindex` meta tag.

### 11.3 Data updates

- `data-bump.yml` runs daily and on manual dispatch. It reads the latest release of
  `datenoio/internacia-db`; if it is newer than the pin, it runs `fetch.py`, updates
  `internacia.lock.json` and opens a pull request with a summary: version, contract version,
  counts added and removed, schema hash changes.
- A release with a new contract MAJOR stops the bump on purpose at `bump.py update`, before the lock
  moves and before any pull request. The pipeline must be updated first: a pull request raises
  `CONTRACT_MAJOR` in `pipeline/lock.py` with the code the new contract needs and moves the lock
  with `bump.py update` (as for v4.0.0).
- `data-bump.yml` also runs on a `repository_dispatch` event of type `internacia-db-release`
  with `client_payload: {"tag": "vX.Y.Z"}`, so the bump can start as soon as a release is
  published. The tag must match `^v[0-9]+\.[0-9]+\.[0-9]+$`. Sending the event is a separate
  change in internacia-db: its release workflow needs a fine-grained token with "Contents: read
  and write" on `datenoio/internacia-web` only, stored as a secret, and a step such as
  `gh api repos/datenoio/internacia-web/dispatches -f event_type=internacia-db-release -f "client_payload[tag]=$TAG"`.

### 11.4 Dedicated server (AX42)

The site moves from GitHub Pages to a Hetzner AX42 dedicated server: room to grow (interface
translations, M3b, take the site past the 1 GB limit of Pages) and control of HTTP behaviour. The
maintainers run other projects on the same server, and its Caddy serves them too. Files are in
[`deploy/ax42/`](../deploy/ax42/); the steps are in its README.

- **Serving.** Caddy, in Docker, serves `/srv/internacia/current` read-only, with Let's Encrypt
  certificates. `deploy/ax42/caddy/internacia-site.caddy` gives the responses Pages gave:
  `Access-Control-Allow-Origin: *` on all of them (widgets and the JSON API are read from other
  origins), UTF-8 charset on Markdown, CSV and text files, `404.html` with status 404, gzip (and
  zstd), `Cache-Control: max-age=600`. Files under `/_astro/` (content-hashed names) are cached
  for a year. A directory URL without its slash redirects with 308 (Pages: 301).
- **Deploy.** The `deploy-ax42` job of `site.yml` takes the same build as Pages (the
  `github-pages` artifact), compresses it with zstd and pipes it over SSH to the user
  `internacia-deploy`. That user's key can run only `internacia-receive` (`restrict,command=…`,
  in an `authorized_keys` that belongs to root). `deploy <sha>` unpacks into
  `releases/<time>-<sha>/` and refuses links and special files, an upload over 8 GB, a build
  without `index.html`, `404.html`, `sitemap.xml`, `llms.txt` or `robots.txt` or with fewer than
  10,000 files, and a deploy that would leave less than 20 GB free. It then swaps the `current`
  symlink atomically and keeps five releases. `rollback` makes the previous release live; `list`
  shows them. The job then checks that the server returns this build's `index.html`.
- **Configuration.** Repository variables `AX42_HOST` (IPv4 address), `AX42_KNOWN_HOSTS` (the
  pinned host key) and `AX42_SITE_HOST` (address the job checks: `next.internacia.io` until DNS
  moves); environment `ax42` with the secret `AX42_SSH_KEY`. Without `AX42_HOST` the job does not
  run. Neither the address nor a key is in the repository.
- **Move.** Test on `next.internacia.io`, then point `internacia.io` (A and AAAA, Cloudflare DNS
  only) at the server. Pages keeps deploying in parallel, so moving back is a DNS change to the
  records of §11.2. The Pages site stays published after the move: it redirects the former address
  `datenoio.github.io/internacia-web/`.
- **Trade-offs.** One server in Falkenstein instead of the Pages CDN. Uptime, patches and
  monitoring are the maintainers' job, and the Caddy is shared with other sites. The site needs no
  backup: git and the pinned release rebuild it.
- **State (2026-11-23).** Prepared: the deploy user, `/srv/internacia`, `internacia-receive` (a
  build of `666b5e1` received and tested), the read-only mount in Caddy, and
  `next.internacia.io` (A record only) serving that build with the same headers as Pages; search,
  maps and widgets checked in a browser; the repository settings. Not done: a deploy by the
  workflow (it runs once this change is on `main`), the DNS move.

## 12. Quality assurance and acceptance

The build fails when any of these checks fails.

| Check | Rule |
|-------|------|
| Integrity | [§4.3](#43-verification) checks pass |
| Count parity | Country cards = rows in `countries` (256 in v5.1.0); intblock cards = rows in `intblocks` (1,606); trade agreement cards = rows in `trade_agreements` (5,195); type pages = 83; topic pages = distinct topic keys |
| Roster parity | For every intblock, the number of current members on the card = rows in `current_memberships` for it |
| Twin parity | For a sample of 50 entities (and all featured ones), HTML, Markdown and JSON carry the same codes, names, statuses and dates; for every entity, route roles (HTML, Markdown, JSON, CSV) and border status (HTML, Markdown, JSON) agree |
| Trade agreements | For every agreement, the parties in HTML, Markdown and JSON = its `party` rows in `trade_agreement_parties`, their grantor and beneficiary roles = the table's `role`, and its instruments = its rows in `trade_agreement_instruments` (contract 5.1); for every country, its trade agreements (with `via`) in HTML and JSON, and their IDs in Markdown, = its rows in `country_trade_agreements`, with the view's `role` in JSON and in the HTML kind filter |
| JSON validity | Every `/api/v1/` file validates against its schema in `/api/v1/schemas/` and against `openapi.json` |
| Links | No broken internal links (lychee, offline mode); external links checked weekly, not on every build |
| Redirects | Every non-disambiguated alias has a redirect page that points to an existing page in its target section (a `moved` intblock ID: an agreement card) |
| Accessibility | axe-core finds no serious or critical issues on the sample pages |
| Performance | Lighthouse CI meets [§10.4](#104-performance-budgets) on sample pages |
| Structured data | JSON-LD on sample pages parses and matches the expected types |
| Guardrails | No page or JSON contains fields that internacia-db does not export, except `_`-prefixed derived fields |
| Embeds | A widget exists exactly for the cards that offer one, has the card's map data or current memberships, is `noindex`, has the card as canonical URL and links to it with the licence |

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

Decisions taken in M2b: the map explorer combines V1 and V2 (`/explore/map/?id=` and
`?mode=count&type=&scope=`); count mode uses `/api/v1/memberships.json` (every current edge,
260 KB gzip). The compare map (V6) colours countries by how many of the selected intblocks they
belong to, not by combination, because combinations outnumber distinguishable colours; the UpSet
chart and the table give the combinations (extended after M3c, see below). The headquarters map (V5) and the hierarchy (V8) are
rendered at build time and work without JavaScript; the hierarchy places each link next to, not
inside, the `<summary>` that opens its branch. The accession timeline (V3) is offered only for
intblocks where at least 30 % of country entries have a joining date (the EU had none before v4.3.0, which dates all 27 members).

Decisions taken in M2c: Pagefind indexes the text of every page that names a search section, but
not tables, charts, maps, link lists or provenance, so a search for an organization finds its card
rather than every member country's membership list. Social images are hand-written SVG rendered
by resvg (Inter, OFL-1.1) and reduced to a 16-colour palette with sharp, not Satori: about 25 KB
per card, 37 MB for all, and the build takes about 75 s. The site is then about 290 MB, near the
300 MB target in §10.3.

Decisions taken when V6 was extended (after M3c):

- **Map.** Only two intblocks get a colour per combination: only A, only B, both (the map's
  three colour slots). From three on, combinations outnumber the colours, so the overlap map stays
  sequential by count and each intblock gets a small map of its own with two colours: members
  only in this intblock, and members also in another selected one. A country in three intblocks is
  the darkest step on the overlap map and "shared" on each of its three small maps; its tooltip and
  its table row name the intblocks. Choosing an UpSet column shows that combination alone on the
  overlap map and in the table. Small maps are not focusable (six maps of 250 regions); the table
  carries the same facts for the keyboard.
- **Rosters** are every current country or territory entry of each intblock, observers and
  partners included (the UN's 195, BRICS+'s 21); the table names each entry's status.
  "Members only" (`?members=only`) keeps members and founding members, the "Member" group of the
  membership maps, in every view. The summary says how many entries with another status each
  intblock has, and names an intblock left with no members (25 list only participants, recipients
  and the like). Income groups are not filtered: they classify every economy they list.
- **Measure.** The UpSet chart, the overlap matrix and the composition tables count countries,
  population or land area (`?measure=`). Population and land area are summed over the members
  that have a value; the summary gives the number summed, the years and the sources, and the share
  of the total over all 256 country records (not a world figure from another source). The data
  table shows each member's value and year, sorted by name.
- **Income groups** are the World Bank `wbgroup` intblocks HIC, UMC, LMC and LIC (217
  economies), not the country field `incomeLevel`, which also gives a group to 31 territories the
  World Bank does not list. A member in none of the four is "not classified by the World Bank".
  The site still holds no GDP; income groups are memberships like any other.
- **Continents** come from the country field `continents`; a country on two continents (Azerbaijan,
  Russia, Turkey) counts in both, and the table says so; three records without one (AN, JG, XK)
  count as "no continent".

- Block type, topic and geography pages.
- Explorers V2–V10, home page map and treemap, Statistics & coverage page.
- Full-text search (Pagefind), social images, Atom feed, citation button.
- `data-bump.yml`.

**Done when** every explorer works with keyboard only, has a data table, and has a shareable URL.

### M3 — Reach

Delivered in parts. **M3a**: embeddable widgets and the receiving side of `repository_dispatch`.
**M3b**: interface translations. **M3c**: custom domain, `internacia.io` (§11.2).

Decisions taken in M3a: widgets are static pages under `/embed/blocks/{id}/` (membership map,
1,255 intblocks whose roster has countries on the map) and `/embed/countries/{code}/` (current
memberships grouped by block type, the eight largest groups first, 254 countries with current
memberships), built from the same data as the cards. They have no header or navigation, open
links in a new tab, take the theme from `?theme=` only (no storage on someone else's page), are
`noindex` with the card as canonical URL, and show the data version, licence and a link to the
card in a footer. The web component `<internacia-embed block|country="…">` (`/embed/widget.js`,
no dependencies) puts the widget in an iframe and sizes it from a `postMessage` that carries only
the height and title; it accepts messages only from its own frame and origin. Widgets have no
Markdown or JSON twin: the card and its twins hold the facts. `/embed/` documents the widgets,
with live examples. Country lists are compact strings (France has about 500 entries); the widgets
add about 17 MB, so the site is about 305 MB, above the 300 MB target of §10.3 and well under the
1 GB limit of GitHub Pages (§10.3 gives the current size, back under the target); M3b must plan
its size before adding languages. The dedicated server of §11.4 has room for far more; the 1 GB
limit goes away when Pages stops being the fallback.

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
| Q1 | Domain name | `internacia.io` (§11.2) |
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
