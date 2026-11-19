# internacia-web

A static website for [internacia-db](https://github.com/datenoio/internacia-db): cards, maps and
timelines for countries, international organizations and country groupings, made for people and
for AI agents alike. Part of the [Dateno](https://dateno.io) open-source project.

**Status:** milestone M1a — country and organization cards with Markdown and JSON twins,
`llms.txt` and post-build checks. Maps and search arrive in M1b.
Temporary address: <https://datenoio.github.io/internacia-web/> (not indexed).

- Specification: [docs/SPEC.md](docs/SPEC.md)
- Guide for AI coding agents: [AGENTS.md](AGENTS.md)

## What the site will offer

- A card for every country and territory (256), organization or grouping (1,275), block type (78)
  and topic (153) in internacia-db.
- Membership maps, accession and founding timelines, a headquarters map, organization comparison
  and hierarchy views, and a statistics and coverage page.
- A Markdown and a JSON twin for every card, a static JSON API with an OpenAPI description,
  `llms.txt`, and schema.org JSON-LD.
- Hosting on GitHub Pages under its own domain, rebuilt from pinned internacia-db releases.

## Build locally

Needs Python 3.11+, Node.js 22.23.4+ and git. From the repository root:

```bash
python -m venv .venv && .venv/bin/pip install -r pipeline/requirements-dev.txt
.venv/bin/python pipeline/fetch.py        # download and verify the pinned release
.venv/bin/python pipeline/build_data.py   # write site/src/generated/
(cd site && npm ci && npm run build)      # static site in site/dist/
.venv/bin/python pipeline/check_site.py   # check the built site against the data
```

`npm run dev` (in `site/`) serves the site at <http://localhost:4321/internacia-web/>.

## Data

All facts come from a pinned GitHub Release of internacia-db. The site adds no data of its own.
Report data errors in [internacia-db issues](https://github.com/datenoio/internacia-db/issues).

## Licence

Code in this repository: MIT (see [LICENSE](LICENSE)).
Data shown on the site: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), from internacia-db;
see its [ATTRIBUTION.md](https://github.com/datenoio/internacia-db/blob/main/ATTRIBUTION.md).
