# internacia-web — AI agent guide

Static website for [internacia-db](https://github.com/datenoio/internacia-db). The specification
is [docs/SPEC.md](docs/SPEC.md). Read it before you write code. When the code and the
specification disagree, raise it; do not silently follow either.

## Current stage

Milestone M0 is in place: lock file, data pipeline, placeholder site, CI. Next is M1
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
- `pipeline/` — Python data stage. `fetch.py` downloads and verifies; `build_data.py` writes
  `site/src/generated/` (not committed). One SQL file per derived dataset in `pipeline/sql/`.
- `site/` — Astro project. `site/site.config.mjs` holds `SITE_URL` and `INDEXABLE`.
- `.github/workflows/site.yml` — builds on pull requests, deploys `main` to GitHub Pages.

## Commands

Run from the repository root, in this order:

```bash
.venv/bin/pip install -r pipeline/requirements-dev.txt   # once, after python -m venv .venv
.venv/bin/python pipeline/fetch.py
.venv/bin/python -m pytest pipeline/tests
.venv/bin/python pipeline/build_data.py
(cd site && npm ci && npm run build)
```

The site build fails if `site/src/generated/meta.json` is missing: run the pipeline first.

## Gotchas

- `compressHTML` is off in `site/astro.config.mjs`: Astro's compression drops the space between
  text and a link on the next line.
- `_meta.git_commit` in the release is a short hash; the lock file holds the full one.
