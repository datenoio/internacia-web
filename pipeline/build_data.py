#!/usr/bin/env python3
"""Turn the fetched internacia-db release into JSON for the site (SPEC §10.3).

Reads .cache/internacia/<tag>/ (written by fetch.py) and writes site/src/generated/.
The site build reads only these JSON files; it never opens DuckDB.

M0 writes meta.json: data version, build identity and key figures. Cards, indexes and the
static API follow in M1.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import duckdb

from lock import DEFAULT_CACHE, DEFAULT_LOCK, ROOT, Lock, LockError, load_lock

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


def query_one(con: duckdb.DuckDBPyConnection, sql_name: str) -> dict:
    sql = (SQL_DIR / f"{sql_name}.sql").read_text(encoding="utf-8")
    cursor = con.execute(sql)
    columns = [d[0] for d in cursor.description]
    return dict(zip(columns, cursor.fetchone()))


def build(lock: Lock, cache_root: Path, out_dir: Path) -> dict:
    assets = cache_root / lock.tag / "assets"
    db_path = assets / "internacia.duckdb"
    if not db_path.exists():
        raise BuildError(f"{db_path} not found: run pipeline/fetch.py first")

    contract = json.loads((assets / "contract.json").read_text(encoding="utf-8"))
    check_duckdb_version(contract)

    with duckdb.connect(str(db_path), read_only=True) as con:
        identity = check_meta(con, lock)
        counts = query_one(con, "counts")

    meta = {
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
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return meta


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK, help="lock file (default: %(default)s)")
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE, help="cache root (default: %(default)s)")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output folder (default: %(default)s)")
    args = parser.parse_args(argv)
    try:
        meta = build(load_lock(args.lock), args.cache, args.out)
    except (LockError, BuildError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    counts = ", ".join(f"{k} {v}" for k, v in meta["counts"].items())
    print(f"internacia-db {meta['data']['version']} → {args.out / 'meta.json'}: {counts}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
