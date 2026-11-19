#!/usr/bin/env python3
"""Turn the fetched internacia-db release into JSON for the site (SPEC §10.3).

Reads .cache/internacia/<tag>/ (written by fetch.py) and writes site/src/generated/.
The site build reads only these JSON files; it never opens DuckDB.

Files written:

- meta.json        data version, build identity, key figures
- countries.json   country records with derived `_` fields (memberships, borders, similar)
- blocks.json      intblock records with derived `_` fields (roster, structure, similar)
- blocktypes.json  block types with counts
- labels.json      labels for membership statuses, topics and vocabularies
- aliases.json     retired and renamed IDs and what the site does with each
- downloads.json   release files with size and SHA-256
- types.json       block types with their intblocks and founding decades
- topics.json      topics with their intblocks and co-occurring topics
- geography.json   continents and subregions with countries and intblocks
- stats.json       completeness of every field and record counts
- releases.json    internacia-db releases, for the Atom feed
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import duckdb

from derive import (
    DeriveError,
    check_current_rule,
    classify_aliases,
    derive_blocks,
    derive_blocktypes,
    derive_countries,
    derive_labels,
    primary_acronym,
)
from browse import derive_geography, derive_stats, derive_topics, derive_types
from lock import DEFAULT_CACHE, DEFAULT_LOCK, ROOT, Lock, LockError, load_lock
from release import load_release

DEFAULT_OUT = ROOT / "site" / "src" / "generated"
SQL_DIR = Path(__file__).resolve().parent / "sql"

# Tables described by one _meta row each.
DATASETS = ("countries", "intblocks", "blocktypes", "memberships")


class BuildError(RuntimeError):
    """The fetched data does not match the lock file or the contract."""


def _version_tuple(version: str) -> tuple[int, ...]:
    return tuple(int(part) for part in version.split(".")[:3] if part.isdigit())


def check_duckdb_version(contract: dict, installed: str = duckdb.__version__) -> None:
    minimum = contract.get("min_duckdb")
    if minimum and _version_tuple(installed) < _version_tuple(minimum):
        raise BuildError(f"DuckDB {installed} is older than min_duckdb {minimum} in contract.json")


def check_meta(con: duckdb.DuckDBPyConnection, lock: Lock) -> dict:
    """Check _meta against the lock file and table row counts (SPEC §4.3); return build identity."""
    rows = con.execute(
        "SELECT dataset, version, build_date, git_commit, row_count, contract_version, data_license FROM _meta"
    ).fetchall()
    meta = {row[0]: row[1:] for row in rows}
    missing = [name for name in DATASETS if name not in meta]
    if missing:
        raise BuildError(f"_meta has no row for {missing}")

    build_dates, licenses, contracts = set(), set(), set()
    for name in DATASETS:
        version, build_date, git_commit, row_count, contract_version, data_license = meta[name]
        if version != lock.version:
            raise BuildError(f"_meta.version of {name} is {version}, lock file pins {lock.version}")
        if not git_commit or not lock.git_commit.startswith(git_commit):
            raise BuildError(f"_meta.git_commit of {name} is {git_commit}, lock file pins {lock.git_commit}")
        if int(str(contract_version).split(".")[0]) != lock.contract_major:
            raise BuildError(
                f"_meta.contract_version of {name} is {contract_version}; the site supports MAJOR {lock.contract_major}"
            )
        actual = con.execute(f'SELECT count(*) FROM "{name}"').fetchone()[0]
        if actual != row_count:
            raise BuildError(f"_meta.row_count of {name} is {row_count}, table has {actual} rows")
        build_dates.add(build_date)
        licenses.add(data_license)
        contracts.add(contract_version)

    if len(contracts) != 1 or len(licenses) != 1:
        raise BuildError(f"_meta rows disagree: contract {sorted(contracts)}, licence {sorted(licenses)}")
    return {
        "build_date": max(build_dates),
        "contract_version": contracts.pop(),
        "license": licenses.pop(),
    }


def query_rows(con: duckdb.DuckDBPyConnection, sql_name: str) -> list[dict]:
    sql = (SQL_DIR / f"{sql_name}.sql").read_text(encoding="utf-8")
    cursor = con.execute(sql)
    columns = [d[0] for d in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def query_one(con: duckdb.DuckDBPyConnection, sql_name: str) -> dict:
    return query_rows(con, sql_name)[0]


def _group_similar(rows: list[dict], key: str, names: dict[str, str], extra=None) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {}
    for row in rows:
        other = row["other"]
        item = {key: other, "name": names.get(other), "shared": row["shared"], "jaccard": row["jaccard"]}
        if extra:
            item.update(extra(other))
        grouped.setdefault(row[key], []).append(item)
    return grouped


def load_releases(cache_dir: Path) -> list[dict]:
    """Release list fetched by fetch.py (metadata only); empty if it could not be fetched."""
    path = cache_dir / "releases.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def build_meta(lock: Lock, cache_root: Path) -> dict:
    """Check the fetched DuckDB against the lock file and return meta.json content."""
    assets = cache_root / lock.tag / "assets"
    db_path = assets / "internacia.duckdb"
    if not db_path.exists():
        raise BuildError(f"{db_path} not found: run pipeline/fetch.py first")

    contract = json.loads((assets / "contract.json").read_text(encoding="utf-8"))
    check_duckdb_version(contract)

    with duckdb.connect(str(db_path), read_only=True) as con:
        identity = check_meta(con, lock)
        counts = query_one(con, "counts")

    return {
        "data": {
            "repository": lock.repository,
            "tag": lock.tag,
            "version": lock.version,
            "git_commit": lock.git_commit,
            "release_url": lock.release_url,
            **identity,
        },
        "counts": counts,
    }


def build(lock: Lock, cache_root: Path, out_dir: Path) -> dict:
    meta = build_meta(lock, cache_root)
    cache_dir = cache_root / lock.tag
    release = load_release(cache_dir, lock.repository, lock.tag)
    check_current_rule(release)

    with duckdb.connect(str(cache_dir / "assets" / "internacia.duckdb"), read_only=True) as con:
        similar_countries = query_rows(con, "similar_countries")
        similar_blocks = query_rows(con, "similar_blocks")

    country_names = {c["code"]: c["name"] for c in release.countries}
    flags = {c["code"]: c.get("flag_emoji") for c in release.countries}
    block_by_id = {b["id"]: b for b in release.intblocks}

    aliases = classify_aliases(release)
    countries = derive_countries(
        release,
        _group_similar(similar_countries, "code", country_names, lambda o: {"flag_emoji": flags.get(o)}),
        aliases["notes"],
    )
    blocks = derive_blocks(
        release,
        _group_similar(
            similar_blocks,
            "id",
            {k: v["name"] for k, v in block_by_id.items()},
            lambda o: {"acronym": primary_acronym(block_by_id[o])},
        ),
        aliases["notes"],
    )

    out_dir.mkdir(parents=True, exist_ok=True)
    write_json(out_dir / "meta.json", meta)
    write_json(out_dir / "countries.json", countries)
    write_json(out_dir / "blocks.json", blocks)
    write_json(out_dir / "blocktypes.json", derive_blocktypes(release))
    write_json(out_dir / "labels.json", derive_labels(release))
    write_json(
        out_dir / "aliases.json",
        {"pages": aliases["pages"], "intblocks": release.intblock_aliases, "countries": release.country_aliases},
    )
    write_json(out_dir / "downloads.json", release.downloads)
    write_json(out_dir / "types.json", derive_types(release, blocks))
    write_json(out_dir / "topics.json", derive_topics(release, blocks))
    write_json(out_dir / "geography.json", derive_geography(countries, blocks))
    write_json(out_dir / "stats.json", derive_stats(release, blocks))
    write_json(out_dir / "releases.json", load_releases(cache_dir))
    return meta


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK, help="lock file (default: %(default)s)")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help="cache root (default: %(default)s)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output folder (default: %(default)s)")
    args = parser.parse_args(argv)
    try:
        meta = build(load_lock(args.lock), args.cache, args.out)
    except (LockError, BuildError, DeriveError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    counts = ", ".join(f"{k} {v}" for k, v in meta["counts"].items())
    print(f"internacia-db {meta['data']['version']} → {args.out / 'meta.json'}: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
