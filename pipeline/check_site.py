#!/usr/bin/env python3
"""Check the built site against the data it was built from (SPEC §12).

Runs after `astro build`. Fails (exit 1) when any check fails:

- count parity      one HTML card, Markdown twin and JSON twin per country and intblock
- roster parity     current members on each intblock card = rows in current_memberships
- twin parity       HTML, Markdown and JSON carry the same current members / memberships
- JSON validity     every API file parses and carries meta.data_version
- internal links    every site-internal href/src points to a built file
- redirects         every alias page points to an existing card
- structured data   JSON-LD parses and has the expected @type on cards
- guardrails        entity JSON adds only `_`-prefixed fields to internacia-db export fields
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import duckdb

from lock import DEFAULT_CACHE, DEFAULT_LOCK, ROOT, load_lock
from release import read_jsonl_zst

DEFAULT_DIST = ROOT / "site" / "dist"
DEFAULT_GENERATED = ROOT / "site" / "src" / "generated"
SITE_CONFIG = ROOT / "site" / "site.config.mjs"

FEATURED = ["UN", "EU", "AFUNION", "ASEAN", "NATO", "OECD", "G-20", "BRICS", "COMMONWEALTH", "OSCE", "AfCFTA", "JCPOA"]
SAMPLE_COUNTRIES = ["FR", "XK", "PS", "AQ", "US", "CN", "DE", "TW", "EH", "VA"]
SAMPLE_SIZE = 50

HREF = re.compile(r'(?:href|src)="([^"#?]+)')
ROW = re.compile(r"<tr\b([^>]*)>")
ATTR = re.compile(r'data-([a-z]+)="([^"]*)"')
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
REFRESH = re.compile(r'http-equiv="refresh" content="0; url=([^"]+)"')


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.passed: list[str] = []

    def check(self, name: str, problems: list[str]) -> None:
        if problems:
            shown = "\n    ".join(problems[:10])
            more = f"\n    … and {len(problems) - 10} more" if len(problems) > 10 else ""
            self.failures.append(f"{name}: {len(problems)} problem(s)\n    {shown}{more}")
        else:
            self.passed.append(name)


def base_path() -> str:
    match = re.search(r"SITE_URL\s*=\s*'([^']+)'", SITE_CONFIG.read_text(encoding="utf-8"))
    if not match:
        raise SystemExit("SITE_URL not found in site/site.config.mjs")
    path = re.sub(r"^https?://[^/]+", "", match.group(1))
    return path if path.endswith("/") else path + "/"


def sample(items: list[str], featured: list[str]) -> list[str]:
    step = max(1, len(items) // SAMPLE_SIZE)
    return sorted({*items[::step], *(f for f in featured if f in items)})


def table_rows(html: str, table_id: str) -> list[dict]:
    start = html.find(f'id="{table_id}"')
    if start < 0:
        return []
    end = html.find("</table>", start)
    return [dict(ATTR.findall(m.group(1))) for m in ROW.finditer(html, start, end)]


def md_section_ids(md: str, heading_prefix: str) -> set[str]:
    """First-column values of the table under the first heading that starts with heading_prefix."""
    lines = md.splitlines()
    try:
        start = next(i for i, l in enumerate(lines) if l.startswith(f"## {heading_prefix}"))
    except StopIteration:
        return set()
    ids = set()
    body = lines[start + 1 :]
    for i, line in enumerate(body):
        if line.startswith("## "):
            break
        is_header = i + 1 < len(body) and body[i + 1].startswith("|---")
        if line.startswith("| ") and not is_header:
            ids.add(line[2:].split(" | ", 1)[0].strip())
    return ids


def run(dist: Path, generated: Path, lock_path: Path, cache_root: Path) -> Report:
    report = Report()
    base = base_path()
    lock = load_lock(lock_path)
    countries = json.loads((generated / "countries.json").read_text(encoding="utf-8"))
    blocks = json.loads((generated / "blocks.json").read_text(encoding="utf-8"))
    aliases = json.loads((generated / "aliases.json").read_text(encoding="utf-8"))["pages"]

    # Count parity
    problems = []
    for section, items, key in (("countries", countries, "code"), ("blocks", blocks, "id")):
        for item in items:
            ident = item[key]
            for rel in (f"{section}/{ident.lower()}/index.html", f"{section}/{ident.lower()}.md", f"api/v1/{section}/{ident}.json"):
                if not (dist / rel).is_file():
                    problems.append(f"missing {rel}")
        expected = len(items) + sum(1 for a in aliases if a["section"] == section)
        built = sum(1 for p in (dist / section).iterdir() if (p / "index.html").is_file())
        if built != expected:
            problems.append(f"{section}: {built} card folders, expected {expected} ({len(items)} records + aliases)")
    report.check("count parity", problems)

    # Roster parity against the release's own view
    db = cache_root / lock.tag / "assets" / "internacia.duckdb"
    with duckdb.connect(str(db), read_only=True) as con:
        view = dict(con.execute("SELECT intblock_id, count(*) FROM current_memberships GROUP BY 1").fetchall())
    problems = []
    for b in blocks:
        expected = view.get(b["id"], 0)
        doc = json.loads((dist / f"api/v1/blocks/{b['id']}.json").read_text(encoding="utf-8"))
        if doc["data"]["_current_member_count"] != expected:
            problems.append(f"{b['id']}: JSON says {doc['data']['_current_member_count']}, view has {expected}")
        if b["_active"]:
            html = (dist / f"blocks/{b['id'].lower()}/index.html").read_text(encoding="utf-8")
            rows = table_rows(html, "roster-table")
            shown = sum(1 for r in rows if r.get("current") == "yes" and r.get("type") in ("country", "territory"))
            if shown != expected:
                problems.append(f"{b['id']}: HTML roster shows {shown} current countries, view has {expected}")
    report.check("roster parity", problems)

    # Twin parity on a sample
    problems = []
    for bid in sample([b["id"] for b in blocks], FEATURED):
        b = next(x for x in blocks if x["id"] == bid)
        if not b["_active"]:
            continue
        doc = json.loads((dist / f"api/v1/blocks/{bid}.json").read_text(encoding="utf-8"))
        j = {r["id"] for r in doc["data"]["_roster"] if r["current"]}
        h = {r["member"] for r in table_rows((dist / f"blocks/{bid.lower()}/index.html").read_text(encoding="utf-8"), "roster-table") if r.get("current") == "yes"}
        m = md_section_ids((dist / f"blocks/{bid.lower()}.md").read_text(encoding="utf-8"), "Current participants")
        if not (j == h == m):
            problems.append(f"block {bid}: JSON {len(j)}, HTML {len(h)}, Markdown {len(m)} current participants differ")
    for code in sample([c["code"] for c in countries], SAMPLE_COUNTRIES):
        doc = json.loads((dist / f"api/v1/countries/{code}.json").read_text(encoding="utf-8"))
        j = {m["block_id"] for m in doc["data"]["_memberships"] if m["current"]}
        h = {r["block"] for r in table_rows((dist / f"countries/{code.lower()}/index.html").read_text(encoding="utf-8"), "memberships-table") if "block" in r}
        m = md_section_ids((dist / f"countries/{code.lower()}.md").read_text(encoding="utf-8"), "Current memberships")
        if not (j == h == m):
            problems.append(f"country {code}: JSON {len(j)}, HTML {len(h)}, Markdown {len(m)} current memberships differ")
    report.check("twin parity", problems)

    # JSON validity
    problems = []
    for path in sorted((dist / "api").rglob("*.json")):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            problems.append(f"{path.relative_to(dist)}: {exc}")
            continue
        if doc.get("meta", {}).get("data_version") != lock.version:
            problems.append(f"{path.relative_to(dist)}: meta.data_version is not {lock.version}")
    report.check("JSON validity", problems)

    # Internal links, structured data
    link_problems, ld_problems = [], []
    country_dirs = {c["code"].lower() for c in countries}
    block_types = {}
    for html_path in sorted(dist.rglob("*.html")):
        html = html_path.read_text(encoding="utf-8")
        rel = html_path.relative_to(dist).as_posix()
        for href in HREF.findall(html):
            if not href.startswith(base):
                continue
            target = dist / href[len(base) :]
            if href.endswith("/"):
                target = target / "index.html"
            if not target.is_file():
                link_problems.append(f"{rel} → {href}")
        for block in LD.findall(html):
            try:
                ld = json.loads(block)
            except json.JSONDecodeError as exc:
                ld_problems.append(f"{rel}: JSON-LD does not parse: {exc}")
                continue
            types = Counter(node.get("@type") for node in ld.get("@graph", []))
            parts = rel.split("/")
            if parts[0] == "countries" and len(parts) == 3 and parts[1] in country_dirs and not types.get("Country"):
                ld_problems.append(f"{rel}: no Country node")
            if parts[0] == "blocks" and len(parts) == 3:
                block_types[parts[1]] = types
    for b in blocks:
        types = block_types.get(b["id"].lower(), Counter())
        if not any(types.get(t) for t in ("GovernmentOrganization", "Organization", "DefinedTerm")):
            ld_problems.append(f"blocks/{b['id'].lower()}: no organization or term node")
    report.check("internal links", link_problems)
    report.check("structured data", ld_problems)

    # Redirects
    problems = []
    for a in aliases:
        html = (dist / a["section"] / a["alias"].lower() / "index.html").read_text(encoding="utf-8")
        refresh = REFRESH.search(html)
        if a["kind"] == "redirect":
            if not refresh:
                problems.append(f"{a['section']}/{a['alias']}: redirect page without meta refresh")
            elif not (dist / refresh.group(1)[len(base) :] / "index.html").is_file():
                problems.append(f"{a['section']}/{a['alias']}: redirect target {refresh.group(1)} does not exist")
        elif refresh:
            problems.append(f"{a['section']}/{a['alias']}: {a['kind']} page must not redirect")
    report.check("redirects", problems)

    # Guardrails: only export fields plus `_`-prefixed derived fields
    assets = cache_root / lock.tag / "assets"
    allowed = {
        "countries": {k for r in read_jsonl_zst(assets / "countries.jsonl.zst") for k in r},
        "blocks": {k for r in read_jsonl_zst(assets / "intblocks.jsonl.zst") for k in r},
    }
    problems = []
    for section, items, key in (("countries", countries, "code"), ("blocks", blocks, "id")):
        for item in items:
            doc = json.loads((dist / f"api/v1/{section}/{item[key]}.json").read_text(encoding="utf-8"))
            extra = sorted(k for k in doc["data"] if not k.startswith("_") and k not in allowed[section])
            if extra:
                problems.append(f"{section}/{item[key]}: fields not in internacia-db exports: {extra}")
    report.check("guardrails", problems)
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dist", type=Path, default=DEFAULT_DIST)
    parser.add_argument("--generated", type=Path, default=DEFAULT_GENERATED)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    args = parser.parse_args(argv)
    report = run(args.dist, args.generated, args.lock, args.cache)
    for name in report.passed:
        print(f"ok    {name}")
    for failure in report.failures:
        print(f"FAIL  {failure}")
    return 1 if report.failures else 0


if __name__ == "__main__":
    sys.exit(main())
