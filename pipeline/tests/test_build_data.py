import json

import duckdb
import pytest

from build_data import BuildError, build, check_duckdb_version

META_ROW = "('{name}', '{version}', '2026-10-22T11:26:42Z', '{commit}', {rows}, 'hash', 'CC-BY-4.0', '{contract}')"


def make_release(cache_root, lock, *, version=None, commit="930121d", contract="3.1", row_counts=None):
    """Write a tiny internacia.duckdb and contract.json shaped like a real release."""
    assets = cache_root / lock.tag / "assets"
    assets.mkdir(parents=True)
    (assets / "contract.json").write_text(json.dumps({"contract_version": contract, "min_duckdb": "1.0.0"}))
    rows = {"countries": 3, "intblocks": 2, "blocktypes": 1, "memberships": 3, **(row_counts or {})}
    con = duckdb.connect(str(assets / "internacia.duckdb"))
    con.execute("""
        CREATE TABLE countries AS SELECT * FROM (VALUES
            ('FR', 'official_iso3166_1'), ('DE', 'official_iso3166_1'), ('XK', 'user_assigned')
        ) t(code, code_status);
        CREATE TABLE intblocks AS
            SELECT 'EU' AS id, [{'key': 'economy', 'name': 'Economy'}, {'key': 'trade', 'name': 'Trade'}] AS topics
            UNION ALL SELECT 'NATO', [{'key': 'trade', 'name': 'Trade'}];
        CREATE TABLE blocktypes AS SELECT 'intorg' AS id;
        CREATE TABLE memberships AS SELECT * FROM (VALUES
            ('EU', 'FR', 'member', NULL), ('EU', 'DE', 'member', NULL), ('NATO', 'XK', 'former_member', '2020')
        ) t(intblock_id, country_code, status, "left");
        CREATE VIEW current_memberships AS SELECT * FROM memberships WHERE "left" IS NULL;
        CREATE TABLE _meta (dataset VARCHAR, version VARCHAR, build_date VARCHAR, git_commit VARCHAR,
            row_count BIGINT, schema_hash VARCHAR, data_license VARCHAR, contract_version VARCHAR);
    """)
    values = ", ".join(
        META_ROW.format(name=name, version=version or lock.version, commit=commit, rows=n, contract=contract)
        for name, n in rows.items()
    )
    con.execute(f"INSERT INTO _meta VALUES {values}")
    con.close()


def test_build_writes_meta(tmp_path, lock):
    make_release(tmp_path / "cache", lock)
    meta = build(lock, tmp_path / "cache", tmp_path / "out")
    assert meta["counts"] == {
        "countries": 3,
        "iso_countries": 2,
        "intblocks": 2,
        "blocktypes": 1,
        "topics": 2,
        "memberships": 3,
        "current_memberships": 2,
    }
    assert meta["data"]["version"] == "3.1.0"
    assert meta["data"]["contract_version"] == "3.1"
    assert meta["data"]["build_date"] == "2026-10-22T11:26:42Z"
    assert json.loads((tmp_path / "out" / "meta.json").read_text()) == meta


def test_build_requires_fetch(tmp_path, lock):
    with pytest.raises(BuildError, match="run pipeline/fetch.py first"):
        build(lock, tmp_path / "cache", tmp_path / "out")


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"version": "3.0.0"}, "lock file pins 3.1.0"),
        ({"commit": "deadbee"}, "git_commit"),
        ({"contract": "4.0"}, "supports MAJOR 3"),
        ({"row_counts": {"countries": 256}}, "row_count of countries is 256"),
    ],
)
def test_build_rejects_mismatch(tmp_path, lock, kwargs, message):
    make_release(tmp_path / "cache", lock, **kwargs)
    with pytest.raises(BuildError, match=message):
        build(lock, tmp_path / "cache", tmp_path / "out")


def test_check_duckdb_version():
    check_duckdb_version({"min_duckdb": "1.5.4"}, installed="1.5.4")
    check_duckdb_version({}, installed="0.1.0")
    with pytest.raises(BuildError, match="older than min_duckdb"):
        check_duckdb_version({"min_duckdb": "1.5.4"}, installed="1.5.3")
