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
(`site.config.mjs`, `public/CNAME`). Next are interface translations (M3b)
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
  (currently 4; the lock pins v4.2.0, contract 4.2). `bump.py update` refuses a release with another MAJOR and leaves the lock as it
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
  text and a link on the next line.
- `_meta.git_commit` in the release is a short hash; the lock file holds the full one.
- `native_names` (contract 4) is keyed by the entity's own languages, ISO 639-1 or else 639-3
  (`prs`, `gsw`), and either `official` or `common` may be null. Read it through `nativeNameList`
  (`lib/format.ts`), which drops empty entries and names the language from `language_codes.yaml`;
  never look up `native_names.en` (English names are `name` and `official_name`).
- Deprecated include statuses (`associate`, `associated_observer`) stay valid until the next
  MAJOR. Card membership and roster tables and their Markdown twins show the status's own label
  with "(deprecated label)" (`statusDeprecated`); never remap them to `associate_member`.
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
- Do not read the `country_borders` view: it needs DuckDB 2.0, although `contract.json` says
  `min_duckdb` 1.5.4 (DuckDB 1.5.4 raises "Non-inner join on correlated columns not supported").
  `derive.py` applies its rule to the `border_status` table: a row without `until` is current. No
  row means no closure is recorded, never "open". Most rows rest on travel advice, which describes
  crossings for travellers (a `closed` border may still carry freight): the card and its Markdown
  twin say so with `BORDER_EVIDENCE_NOTE` (`lib/design.ts`); do not call a border "closed to goods".
- Block type `intorg` is deprecated (contract 4.1) and stays on 358 records, always last. Never
  select intergovernmental organizations by block type; use `scope_category = 'igo'`.
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
  beyond the first-paint one in `<head>`: inline code is repeated in all ~3,300 pages.
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
- Social images (`src/lib/og.ts`) take about 50 ms each; keep their SVG simple. Site size is near
  the 300 MB target, so check `du -sh site/dist` when adding per-entity files.
- Coverage on the Statistics page follows internacia-db's `*_completeness.yaml` gates; records
  empty by design (`timezone_status`, `membership_applicability`) count as filled.
- Tables with hundreds of rows use the `chunked` class: rows in `<tbody>` chunks with
  `content-visibility: auto` and explicit ARIA table roles. A plain 1,275-row table scored 0.77.
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
