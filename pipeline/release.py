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
    # Language names by countries.native_names key (ISO 639-1, else 639-3), from
    # data/vocabs/language_codes.yaml. Since contract 4 the keys are each entity's own languages.
    native_name_languages: dict[str, str] = field(default_factory=dict)
    # Land-border crossing status (contract 4.1): rows of the border_status table, which carry
    # the note, dates and sources. derive.py applies the country_borders view's rule (a row
    # without `until` is current) and checks it against the view: current status by
    # (country code, neighbour alpha-3), None when no closure is recorded. The view runs on
    # DuckDB 1.5.4 from v4.3.0; before, it needed DuckDB 2.0.
    border_status: list[dict] = field(default_factory=list)
    country_borders: dict[tuple[str, str], str | None] = field(default_factory=dict)
    # Labels of includes[].role (data/schemas/include_roles.yaml) and of the institutional_design
    # subfields and values (data/schemas/institutional_design.yaml), contract 4.1.
    include_roles: dict[str, dict] = field(default_factory=dict)
    institutional_design: dict[str, dict] = field(default_factory=dict)
    # Trade agreements registry (contract 5.0): the trade_agreements and trade_agreement_parties
    # tables, and the rows of the country_trade_agreements view, which expands a bloc party (the
    # EU) to its current members with `via` set to the bloc. Coverage of the view is current only.
    trade_agreements: list[dict] = field(default_factory=list)
    trade_agreement_parties: list[dict] = field(default_factory=list)
    country_trade_agreements: list[dict] = field(default_factory=list)


def _text(value) -> str:
    return " ".join(str(value or "").split())


def _include_roles(path: Path) -> dict[str, dict]:
    """Role labels by key; each role lists the block types (route kinds) it applies to."""
    if not path.exists():
        return {}
    raw = _yaml(path) or {}
    kinds = raw.get("kinds") or {}
    out = {}
    for key, role in (raw.get("roles") or {}).items():
        out[str(key)] = {
            "name": role.get("name", key),
            "description": _text(role.get("description")),
            "blocktypes": sorted({t for k in kinds.values() if key in (k.get("roles") or []) for t in k.get("blocktypes") or []}),
        }
    return out


def _institutional_design(path: Path) -> dict[str, dict]:
    """Subfield labels and their value labels, in the catalog's order."""
    if not path.exists():
        return {}
    fields = (_yaml(path) or {}).get("fields") or {}
    return {
        str(key): {
            "name": f.get("name", key),
            "kind": f.get("kind"),
            "description": _text(f.get("description")),
            "values": {
                str(v): {"name": val.get("name", v), "description": _text(val.get("description"))}
                for v, val in (f.get("values") or {}).items()
            },
        }
        for key, f in fields.items()
    }


def _rows(con, sql: str) -> list[dict]:
    cursor = con.execute(sql)
    columns = [d[0] for d in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


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
        # description and deprecated: contract 4.1. A deprecated block type stays valid in 4.x.
        blocktypes = [
            {**r, "other_names": r["other_names"] or []}
            for r in _rows(con, "SELECT id, name, description, deprecated, other_names FROM blocktypes ORDER BY id")
        ]
        memberships = _rows(
            con, 'SELECT intblock_id, country_code, include_type, status, joined, "left", role FROM memberships'
        )
        current = {
            (r[0], r[1], r[2])
            for r in con.execute("SELECT intblock_id, country_code, include_type FROM current_memberships").fetchall()
        }
        border_status = _rows(
            con,
            'SELECT country_a, country_b, status, since, "until", note, last_verified, provenance '
            "FROM border_status ORDER BY country_a, country_b",
        )
        country_borders = {
            (r[0], r[1]): r[2]
            for r in con.execute(
                "SELECT country_code, neighbor_iso3, current_status FROM country_borders"
            ).fetchall()
        }
        # The registry's JSONL exports carry the same columns as these tables.
        trade_agreements = _rows(con, "SELECT * FROM trade_agreements ORDER BY id")
        trade_agreement_parties = _rows(
            con,
            'SELECT agreement_id, party_id, party_type, status, signed, in_force, joined, "left", note, source '
            "FROM trade_agreement_parties ORDER BY agreement_id, party_id",
        )
        country_trade_agreements = _rows(
            con,
            "SELECT country_code, agreement_id, via, agreement_type, agreement_status, in_force "
            "FROM country_trade_agreements ORDER BY country_code, agreement_id",
        )

    statuses = _yaml(source / "schemas" / "includes_status.yaml")["statuses"]
    topics = {k: v.get("name", k) for k, v in _yaml(source / "schemas" / "topics.yaml")["topics"].items()}
    vocabs = {}
    for name in VOCAB_FILES:
        path = source / "vocabs" / f"{name}.yaml"
        if path.exists():
            vocabs[name] = {str(item["id"]): item.get("name", str(item["id"])) for item in _yaml(path)}
    language_codes = source / "vocabs" / "language_codes.yaml"
    native_name_languages = (
        {str(item["key"]): item.get("name", str(item["key"])) for item in _yaml(language_codes) if item.get("key")}
        if language_codes.exists()
        else {}
    )

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
        native_name_languages=native_name_languages,
        border_status=border_status,
        country_borders=country_borders,
        include_roles=_include_roles(source / "schemas" / "include_roles.yaml"),
        institutional_design=_institutional_design(source / "schemas" / "institutional_design.yaml"),
        trade_agreements=trade_agreements,
        trade_agreement_parties=trade_agreement_parties,
        country_trade_agreements=country_trade_agreements,
    )
