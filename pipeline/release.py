"""Load a fetched internacia-db release from the cache (SPEC §4.1).

Entity records come from the full JSONL exports (every field, including the ones that only the
full JSON carries). Relations that the contract defines as views, such as current_memberships,
come from DuckDB so the site uses the release's own definition.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import duckdb
import yaml
import zstandard

VOCAB_FILES = (
    "broadcast_systems",
    "dvd_regions",
    "legal_systems",
    "rail_gauges",
    "writing_directions",
    "writing_systems",
    "language_codes",
)


def read_jsonl_zst(path: Path) -> list[dict]:
    with path.open("rb") as fh:
        text = zstandard.ZstdDecompressor().stream_reader(fh).read().decode("utf-8")
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def _yaml(path: Path):
    return yaml.safe_load(path.read_text(encoding="utf-8"))


@dataclass
class Release:
    countries: list[dict]
    intblocks: list[dict]
    blocktypes: list[dict]
    memberships: list[dict]
    current: set[tuple[str, str, str]]
    statuses: dict[str, dict]
    topics: dict[str, str]
    vocabs: dict[str, dict[str, str]]
    intblock_aliases: list[dict]
    country_aliases: list[dict]
    downloads: list[dict] = field(default_factory=list)
    # Completeness gates from data/schemas/{countries,intblocks}_completeness.yaml (`fields`).
    completeness_rules: dict[str, dict[str, dict]] = field(default_factory=dict)


def _downloads(assets: Path, repository: str, tag: str) -> list[dict]:
    """Release files with size and SHA-256, for the Data & API page."""
    package = json.loads((assets / "datapackage.json").read_text(encoding="utf-8"))
    base = f"https://github.com/{repository}/releases/download/{tag}/"
    sums = {}
    for line in (assets / "SHA256SUMS").read_text(encoding="utf-8").splitlines():
        if line.strip():
            digest, name = line.split(maxsplit=1)
            sums[name.strip().lstrip("*")] = digest
    db = assets / "internacia.duckdb"
    files = [
        {
            "name": "internacia.duckdb",
            "format": "duckdb",
            "bytes": db.stat().st_size,
            "sha256": sums["internacia.duckdb"],
            "url": base + "internacia.duckdb",
        }
    ]
    for res in package.get("resources", []):
        files.append(
            {
                "name": res["path"],
                "format": res.get("format"),
                "bytes": res.get("bytes"),
                "sha256": str(res.get("hash", "")).removeprefix("sha256:"),
                "url": base + res["path"],
            }
        )
    files.append({"name": "SHA256SUMS", "format": "text", "bytes": None, "sha256": None, "url": base + "SHA256SUMS"})
    return files


def load_release(cache_dir: Path, repository: str, tag: str) -> Release:
    assets = cache_dir / "assets"
    source = cache_dir / "source" / "data"

    with duckdb.connect(str(assets / "internacia.duckdb"), read_only=True) as con:
        blocktypes = [
            {"id": r[0], "name": r[1], "other_names": r[2] or []}
            for r in con.execute("SELECT id, name, other_names FROM blocktypes ORDER BY id").fetchall()
        ]
        cols = ["intblock_id", "country_code", "include_type", "status", "joined", "left"]
        memberships = [
            dict(zip(cols, r))
            for r in con.execute(
                'SELECT intblock_id, country_code, include_type, status, joined, "left" FROM memberships'
            ).fetchall()
        ]
        current = {
            (r[0], r[1], r[2])
            for r in con.execute("SELECT intblock_id, country_code, include_type FROM current_memberships").fetchall()
        }

    statuses = _yaml(source / "schemas" / "includes_status.yaml")["statuses"]
    topics = {k: v.get("name", k) for k, v in _yaml(source / "schemas" / "topics.yaml")["topics"].items()}
    vocabs = {}
    for name in VOCAB_FILES:
        path = source / "vocabs" / f"{name}.yaml"
        if path.exists():
            vocabs[name] = {str(item["id"]): item.get("name", str(item["id"])) for item in _yaml(path)}

    return Release(
        countries=read_jsonl_zst(assets / "countries.jsonl.zst"),
        intblocks=read_jsonl_zst(assets / "intblocks.jsonl.zst"),
        blocktypes=blocktypes,
        memberships=memberships,
        current=current,
        statuses=statuses,
        topics=topics,
        vocabs=vocabs,
        intblock_aliases=json.loads((assets / "intblocks_aliases.json").read_text(encoding="utf-8")),
        country_aliases=json.loads((assets / "countries_aliases.json").read_text(encoding="utf-8")),
        downloads=_downloads(assets, repository, tag),
        completeness_rules={
            name: (_yaml(source / "schemas" / f"{name}_completeness.yaml") or {}).get("fields") or {}
            for name in ("countries", "intblocks")
            if (source / "schemas" / f"{name}_completeness.yaml").exists()
        },
    )
