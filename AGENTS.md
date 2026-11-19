# internacia-web — AI agent guide

Static website for [internacia-db](https://github.com/datenoio/internacia-db). The specification
is [docs/SPEC.md](docs/SPEC.md). Read it before you write code. When the code and the
specification disagree, raise it; do not silently follow either.

## Current stage

M0 and M1 are in place: pipeline, country and intblock cards with Markdown and JSON twins,
membership and locator maps, entity finder, 404 suggestions, OpenAPI and JSON Schemas, `llms.txt`,
sitemap, post-build checks and an axe/Lighthouse audit. M2a adds block type, topic, geography and
statistics pages, the home map, the Atom feed, citations and `data-bump.yml`. M2b adds the
explorers under `/explore/`. Next is M2c: Pagefind and social images
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
- `historical-country` roster entries reuse current codes (`DE` is the GDR in such rows): never
  link them to country cards, never count them as a country's memberships.
- An intblock alias with reason `disambiguated` gets an explanation page, never a redirect; when
  the old ID now names a current record, the note goes on that record's card.
- `lang: en` acronyms in the data include other languages' forms (the African Union lists "UA"
  first); use `_acronym` (`derive.primary_acronym`), never the first English acronym.
- Intblock IDs may contain `+` (`G8+5`); JSON Schemas and URL helpers must allow it.
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
- Explorers keep their state in the query string (`scripts/explore.ts` `setParams`); default
  states must use intblocks that have the data the view needs.
- Coverage on the Statistics page follows internacia-db's `*_completeness.yaml` gates; records
  empty by design (`timezone_status`, `membership_applicability`) count as filled.
- Tables with hundreds of rows use the `chunked` class: rows in `<tbody>` chunks with
  `content-visibility: auto` and explicit ARIA table roles. A plain 1,275-row table scored 0.77.
- In `.astro` templates, build sentences that end in punctuation as one string expression:
  JSX-style whitespace otherwise leaves a space before the period.
