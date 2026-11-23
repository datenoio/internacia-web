# internacia-web — AI agent guide

Static website for [internacia-db](https://github.com/datenoio/internacia-db). The specification
is [docs/SPEC.md](docs/SPEC.md). Read it before you write code. When the code and the
specification disagree, raise it; do not silently follow either.

## Current stage

M0 and M1 are in place: pipeline, country and intblock cards with Markdown and JSON twins,
membership and locator maps, entity finder, 404 suggestions, OpenAPI and JSON Schemas, `llms.txt`,
sitemap, post-build checks and an axe/Lighthouse audit. M2a adds block type, topic, geography and
statistics pages, the home map, the Atom feed, citations and `data-bump.yml`. M2b adds the
explorers under `/explore/`; M2c adds full-text search (`/search/`, Pagefind) and per-card social
images (`/og/…png`). M3a adds embeddable widgets (`/embed/`, `public/embed/widget.js`) and the
`repository_dispatch` trigger of `data-bump.yml`. M3c moves the site to its domain, `internacia.io`
(`site.config.mjs`, `public/CNAME`). Data v5.0.0 (contract 5) adds the trade agreements registry:
`/agreements/` cards with Markdown and JSON twins, a trade agreements section on country cards, and
redirects from the intblock IDs that moved there. Data v5.1.0 (contract 5.1) widens the registry
to 5,195 records (investment treaties, trade relations agreements, preference schemes with grantor
and beneficiary roles) and adds provisional application, sub-schemes and instruments. Next are
interface translations (M3b)
([SPEC §13](docs/SPEC.md#13-milestones)).

## Rules

- **Data comes only from a pinned internacia-db GitHub Release** (`internacia.lock.json`) and the
  vocabulary files at the matching git tag. Never read internacia-db source YAML from a branch, and
  never resolve "latest" at build time.
- **Add no facts.** No socioeconomic indicators (HDI, GDP, government type and similar), no data
  from other sources. Derived fields in JSON start with `_`.
- **Follow the internacia-db join rules** ([SPEC §4.4](docs/SPEC.md#44-data-rules-inherited-from-internacia-db)):
  join memberships on IDs, resolve `borders` through `iso3code`, read `.value` of indicator
  structs, treat enums as open, use `current_memberships` for current members.
- **Same facts in HTML, Markdown and JSON.** Generate all three from the same data step.
- **No fact only in JavaScript.** Every chart has a server-rendered data table.
- **Do not hard-code the domain.** Read `SITE_URL` from the site config.
- **Neutral wording** for disputed entities: use internacia-db's labels and classifications as they are.

## Layout

- `internacia.lock.json` — pinned release; bump it only through a pull request that builds.
- `pipeline/` — Python data stage. `fetch.py` downloads and verifies; `release.py` loads the
  release; `derive.py` adds `_` fields; `build_data.py` writes `site/src/generated/` (not
  committed); `check_site.py` checks `site/dist/` after the build. One SQL file per derived
  dataset in `pipeline/sql/`.
- `site/src/lib/` — data loading, URLs, labels, Markdown twins, JSON-LD, `llms.txt`. HTML pages
  and their `.md` / `.json` endpoints read the same generated data.
- `site/` — Astro project. `site/site.config.mjs` holds `SITE_URL` and `INDEXABLE`.
- `.github/workflows/site.yml` — builds on pull requests, deploys `main` to GitHub Pages.
- `.github/workflows/data-bump.yml` — daily; `pipeline/bump.py` moves the lock to a newer release,
  the workflow builds and checks the site and opens a pull request.
- The pipeline reads one internacia-db contract MAJOR, `CONTRACT_MAJOR` in `pipeline/lock.py`
  (currently 5; the lock pins v5.1.0, contract 5.1). `bump.py update` refuses a release with another MAJOR and leaves the lock as it
  is; a lock with another `contract_major` fails to load. For a new MAJOR, raise the constant
  together with the code the new contract needs, then run `bump.py update` in the same pull request.

## Commands

Run from the repository root, in this order:

```bash
.venv/bin/pip install -r pipeline/requirements-dev.txt   # once, after python -m venv .venv
.venv/bin/python pipeline/fetch.py
.venv/bin/python -m pytest pipeline/tests
.venv/bin/python pipeline/build_data.py
(cd site && npm ci && npm run build)
.venv/bin/python pipeline/check_site.py
(cd site && npx playwright install chromium && npm run audit)   # axe + Lighthouse; --no-lh for axe only
```

The site build fails if `site/src/generated/meta.json` is missing: run the pipeline first.

## Gotchas

- `compressHTML` is off in `site/astro.config.mjs`: Astro's compression drops the space between
  text and a link on the next line. The `trim-html` integration (`site/scripts/trim-html.mjs`)
  removes template indentation after the build instead and keeps each line break, so the space
  stays. Only `<pre>` (plus `<textarea>`, `<script>`, `<style>`) keeps its whitespace: never rely
  on `white-space: pre` or `pre-wrap` on another element.
- `_meta.git_commit` in the release is a short hash; the lock file holds the full one.
- `native_names` (contract 4) is keyed by the entity's own languages, ISO 639-1 or else 639-3
  (`prs`, `gsw`), and either `official` or `common` may be null. Read it through `nativeNameList`
  (`lib/format.ts`), which drops empty entries and names the language from `language_codes.yaml`;
  never look up `native_names.en` (English names are `name` and `official_name`).
- Deprecated include statuses (`associate`, `associated_observer`) stay valid until a MAJOR
  removes them (contract 5.0 still lists them, `removal: next MAJOR`). Card membership and roster tables and their Markdown twins show the status's own label
  with "(deprecated label)" (`statusDeprecated`); never remap them to `associate_member`. No
  record uses them from v4.3.0 on; keep the handling until a MAJOR removes them.
- Trade agreements registry (contract 5.0): `trade_agreements`, `trade_agreement_parties` and the
  `country_trade_agreements` view, read from DuckDB (the JSONL exports have the same columns).
  `derive.derive_agreements` writes `agreements.json`; country cards get `_trade_agreements` (the
  view: current coverage, a bloc party such as the EU expanded to its current members, `via` = the
  bloc, every agreement status) and `_former_trade_agreements`; intblock cards get
  `_trade_agreement` (the linked record) and `_party_to_agreements` (as a bloc). Wording shared by
  cards and twins is in `lib/agreements.ts` (`CATALOGUE_NOTE`, `COVERAGE_NOTE`, …). The registry
  has no trade values: never add or rank by any. `check_site.py` compares parties and country
  coverage in every form with the table and the view.
- Contract 5.1 registry facts: `investment` (3,503 records, `-BIT` IDs) and `trade_relations`
  (`-TRA`) grant no preferences, and a preference scheme's parties have `role` grantor or
  beneficiary (`party` on every other agreement). Count them apart from trade agreements
  (internacia-db `docs/ai-consumers.md`): `agreementKind` and `kindSummary` (`lib/agreements.ts`)
  give the kind of a country's or bloc's row, the summaries and the country card's "Kind" filter.
  Show a role only when it is grantor or beneficiary (`showsRole`). `in_force` is the definitive
  entry into force and `provisional_application` the start of provisional application: an
  agreement applied only provisionally (`CETA`) is `in_force` with no `in_force` date, so the
  index shows the provisional date marked "provisional"; never copy one date into the other.
  `parent` makes `_parent`/`_children` (GSP → EU-GSP → EU-GSP-EBA); `trade_agreement_instruments`
  make `_instruments`, which never change the agreement's own status or dates. The new catalogue
  IDs (`wto_pta_ids`, `gptad_id`, `dta_id`, `unctad_iia_id`, `unts_registration`) are shown as
  codes: the records' `links` hold the catalogue URLs, so build none from an ID.
  `check_site.py` compares party roles and instruments in every form with the tables.
- The entity finder index (`/api/v1/search-index.json`, ≤ 300 KB gzip) leaves out investment
  treaties: with them it is about 360 KB gzip (v5.1.0), without them about 280 KB. Pagefind and
  the country cards still find them.
- Agreement cards list provenance grouped by source (`provenanceGroups`): a catalogue record cites
  one page for four fields. The JSON twin keeps the rows as they are.
- A linked registry record (`intblock_id`, three or more parties) has the intblock's ID and reads
  its parties from the intblock's `includes`; its `name` may be null upstream, so show `_name`.
- Intblock aliases with `reason = moved`, `target_dataset = trade_agreements` (34 two-party FTAs in
  v5.0.0) redirect `/blocks/{id}/` and its twins to `/agreements/{id}/`: `classify_aliases` sets
  `target_section`, and alias pages, Markdown and JSON build the target URL from it.
- `historical-country` roster entries reuse current codes (`DE` is the GDR in such rows): never
  link them to country cards, never count them as a country's memberships.
- An intblock alias with reason `disambiguated` gets an explanation page, never a redirect; when
  the old ID now names a current record, the note goes on that record's card.
- `lang: en` acronyms in the data include other languages' forms (the African Union lists "UA"
  first); use `_acronym` (`derive.primary_acronym`), never the first English acronym.
- Intblock IDs may contain `+` (`G8+5`); JSON Schemas and URL helpers must allow it.
- Contract 4.1 facts (`includes[].role`, `institutional_design`, `border_status`) go through
  `lib/design.ts` so the card and its Markdown twin say the same. `check_site.py` compares route roles
  (HTML, Markdown, JSON, CSV) and border status (HTML, Markdown, JSON) for every entity.
- `includes[].role` is set only on pipelines and corridors: the "Route role" column appears only when
  a row has one. The roster CSV and `/api/v1/memberships.json` append `role` as the last column, so
  earlier column positions stay.
- `institutional_design`: an absent object or subfield means unknown, never "none"; `none` inside
  `independent_organs` or `enforcement` is a value. `veto_holders` are alpha-2 codes.
- Card border facts come from the `border_status` table (note, dates, sources): `derive.py`
  applies the `country_borders` view's rule (a row without `until` is current) and
  `check_border_rule` fails the build if the result differs from the view. The view runs on DuckDB
  1.5.4 from v4.3.0; releases before it raise "Non-inner join on correlated columns not
  supported" there. No row means no closure is recorded, never "open". Most rows rest on travel
  advice, which describes crossings for travellers (a `closed` border may still carry freight):
  the card and its Markdown twin say so with `BORDER_EVIDENCE_NOTE` (`lib/design.ts`); do not
  call a border "closed to goods".
- Block type `intorg` is deprecated (contract 4.1) and stays on its records (contract 5.0 keeps
  it), never first. Never select intergovernmental organizations by block type; use
  `scope_category = 'igo'`. `eccurr`
  (`OECS`) and `cuscurr` (`CEMAC`, `UEMOA`) are deprecated from contract 4.4, last on their records;
  the type page links the replacements (`economic`/`customs` with `currency`). Type pages and
  cards mark deprecated types from the `blocktypes` table, so no code lists them by name.
- Primary block type `currency` means a currency union with its roster (`EUROAREA`), dissolved
  ones included (`LMU`, status `historical`); secondary `currency` also marks organizations that
  administer a currency (`UEMOA`) and central banks (`ECB`). Never call a secondary `currency`
  record's members a currency roster.
- A list of links with separators (`, `, `; `) must be one line in `.astro`: `{xs.map((x, i) =>
  <>{i > 0 && ', '}<a>…</a></>)}`. A line break inside the fragment puts a space before the comma.
- The base map is one static SVG (`/assets/world.svg`, Natural Earth 1:110m); records without a
  polygon are dots at their centroid. Map colours are the dataviz palette's first three slots,
  validated all-pairs in both themes; do not add a fourth colour to the map.
- Layout must not shift when scripts run (Lighthouse CLS): give elements that need JavaScript the
  class `js-only` (shown from first paint via `html.js`, set in `<head>`), never `hidden` +
  unhide; default filters are a table attribute matched by static CSS.
- An element with the `hidden` attribute must not get a `display` value from CSS without a
  matching `[hidden] { display: none }` rule (the map tooltip showed as an empty box).
- Chart builders live in `site/src/scripts/charts.ts` and run both at build time (`set:html`)
  and in the browser; every string from data goes through `esc()`. Text labels stay outside
  focusable chart groups (axe: label-content-name-mismatch).
- `.table-wrap` scrolls in both directions with a `max-height`: a sticky header only sticks inside
  its scrolling ancestor, so that is where it sticks. A wrapper whose table has no links or buttons
  needs `tabindex="0" role="region" aria-label` (axe: scrollable-region-focusable). Chunked tables
  stick the whole `thead`, because a grid-item `th` cannot stick.
- A map figure with `data-card-base` links its coloured regions to country cards (role `link`);
  its `.map-canvas` must then be role `group`, not `img` (axe: nested-interactive). The country
  locator map has no links.
- Behaviour shared by every page (theme, header menus, copy buttons, in-page navigation) is in
  `scripts/site.ts`, bundled with the finder. Do not add `is:inline` scripts to `Base.astro`
  beyond the first-paint one in `<head>`: inline code is repeated in all ~4,800 pages.
- The organizations index filters with facets (`tables.ts`, `data-facets`, `data-url-state`). The
  facet counts in the HTML are for the default view (active only) and must follow the same rule
  as the script: a value counts the rows that pass every other filter.
- `MembershipMap` zooms with `data-view` (`worldmap.ts` `viewFor`): boxes use each record's
  largest polygon, so overseas parts do not widen the view; the viewBox keeps the world map's
  aspect ratio so nothing changes size (CLS).
- Explorers pick entities with `EntityPicker` (`scripts/picker.ts`): it sets the input to
  "ID — Name" and fires `change` only for a chosen result; the browser's own `change` for
  half-typed text is stopped. `renderMap(figure, data, zoom)` fits the view to `zoom` (an empty
  list shows the world; leave it out to keep the view, as the timeline does between years). The
  browser zoom reads each record's `data-box` in `world.svg`; `map.ts` `viewOf` and
  `worldmap.ts` `viewFor` are the same rule and must stay in step.
- Explorers keep their state in the query string (`scripts/explore.ts` `setParams`); default
  states must use intblocks that have the data the view needs.
- `npm run build` runs `astro build` and then Pagefind. A page is indexed only when its `Base`
  gets a `section` prop; alias, search and 404 pages must not get one. Tables, charts and maps
  are excluded from the index in the build script.
- Social images (`src/lib/og.ts`) take about 50 ms each; keep their SVG simple. They use about
  eight colours, so a smaller palette saves nothing. Trade agreement cards use the default image.
  Site size is about 427 MB with v5.1.0 (356 MB of file content), under the target of ≤ 450 MB
  (SPEC §10.3), raised from 300 MB when the registry grew from 839 to 5,195 records: agreement
  cards take 92 MB, each card with its twin 16 KB on disk (it was 294 MB with v5.0.0, 272 MB with
  v4.4.0, 375 MB before indentation was removed); check `du -sh site/dist` when adding per-entity
  files or per-row markup. Write per-entity JSON with `json(body, false)`: indentation was a third of the
  API's bytes. Anything per membership row is paid about 140,000 times (both cards of each edge):
  status definitions are listed once under the table (`StatusDefs.astro`; `site.ts` makes them
  the cells' tooltips), never a `title` per row, and JSON-LD list items carry no `ListItem`.
- Coverage on the Statistics page follows internacia-db's `*_completeness.yaml` gates; records
  empty by design (`timezone_status`, `membership_applicability`) count as filled.
- Tables with hundreds of rows use the `chunked` class: rows in `<tbody>` chunks with
  `content-visibility: auto` and explicit ARIA table roles. A plain 1,275-row table scored 0.77.
  Each chunked table needs its own `--cols` in `global.css` (`#blocks-table`,
  `#agreements-table`): without it every row is one column, one cell per line. `npm run audit`
  fails on a chunked table with one grid column. A chunk's `--chunk-height` (its
  `contain-intrinsic-size` until rendered) must exceed its real height: a skipped chunk's rows
  overflow a smaller estimate, overlap the next chunk's, and axe fails `target-size`. Re-measure
  when rows get taller (v5.1.0: long official titles of `-TRA` and `-TIFA` records make rows up to
  406px; the tallest agreements chunk is 13,200px at 1280px and 18,700px on a phone).
- Lighthouse's simulated 4G waits for the whole HTML document before the first paint, about
  5.6 ms per KB gzip: `/agreements/` at 290 KB (v5.1.0) scored performance 0.94-0.96 against the
  0.95 gate, FCP 2.25 s. Its rows carry no filter attributes (`data-rows`: `tables.ts` loads them
  from `/agreements/facets.json` on the first reach for a control; `agreementFacetValues` in
  `lib/agreements.ts` feeds both the file and the facet counts), the name is sorted on its link
  (`data-sort-by`) and phone labels come from `--label-N` on the table: 150 KB, FCP 1.5 s,
  score 1. `check_site.py` fails the index above 180 KB gzip (`INDEX_HTML_GZIP_MAX`, SPEC §10.4).
  Per-row markup there is paid 5,195 times: add none without measuring.
- axe's partial run (`@axe-core/playwright` default) loses the page's context on `/agreements/`
  (about 55,000 elements): `audit.mjs` runs it in legacy mode with violations only (`AXE_LEGACY`).
  Add any other page of that size there.
- In `.astro` templates, build sentences that end in punctuation as one string expression:
  JSX-style whitespace otherwise leaves a space before the period.
- The compare explorer (`scripts/compare.ts`) colours by combination only for two intblocks (the
  map's three slots); from three on it adds one small map per intblock (`data-static`: regions not
  focusable, one `role="img"` canvas). It sums population and land area from
  `/api/v1/countries.json` and states years and sources; never sort or colour countries by them
  (SPEC §2.2). Income groups are the `wbgroup` intblocks HIC, UMC, LMC and LIC, not `incomeLevel`.
- Compare rosters are every current country or territory entry, observers and partners included;
  the table shows each entry's status, so never call them all "members". "Members only"
  (`?members=only`) keeps `groupOf(status) === 'm'` (member, founding member), as the maps do.
- Widgets under `/embed/` use `layouts/Embed.astro`: no header, `<base target="_blank">`,
  `noindex`, canonical URL = the card, theme from `?theme=` only (never storage). A card shows its
  embed code exactly when the widget exists (`lib/embed.ts` `blockEmbeddable`,
  `countryEmbeddable`); `check_site.py` compares the two and the widget's facts with the card's.
- `public/embed/widget.js` finds the widgets relative to its own URL; keep it free of the domain
  and of dependencies. It trusts a height message only from its own iframe and origin.
