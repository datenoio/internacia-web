from types import SimpleNamespace

from browse import completeness, decade, derive_geography, derive_types, slugify


def test_slugify():
    assert slugify("South-Eastern Asia") == "south-eastern-asia"
    assert slugify("Australia and New Zealand") == "australia-and-new-zealand"


def test_decade():
    assert decade("1949-04-04") == 1940
    assert decade("1950s") == 1950
    assert decade("2001") == 2000
    assert decade(None) is None
    assert decade("unknown") is None


def test_completeness_gates_and_exemptions():
    records = [
        {"code": "AA", "timezones": ["UTC"], "gini": 1},
        {"code": "AQ", "timezones": [], "timezone_status": "not_applicable"},
        {"code": "BB", "timezones": []},
    ]
    rows = {r["field"]: r for r in completeness(records, "code", {"timezones": {"max_null_rate": 0.0, "mode": "error"}})}
    tz = rows["timezones"]
    assert tz["missing"] == ["BB"]  # AQ is empty by design
    assert tz["gate"]["met"] is False
    assert rows["gini"]["missing"] == ["AQ", "BB"] and "gate" not in rows["gini"]
    # gated fields come first
    assert list(rows)[0] == "timezones"


def test_geography_disambiguates_shared_labels():
    countries = [
        {"code": "BR", "name": "Brazil", "continents": ["South America"], "subregion": "South America", "code_status": "official_iso3166_1"},
        {"code": "FR", "name": "France", "continents": ["Europe"], "subregion": "Western Europe", "code_status": "official_iso3166_1"},
    ]
    blocks = [{"id": "MERCOSUR", "name": "Mercosur", "_active": True, "regions": ["South America"]}]
    areas = {(a["kind"], a["name"]): a for a in derive_geography(countries, blocks)}
    assert areas[("continent", "South America")]["slug"] == "south-america"
    assert areas[("subregion", "South America")]["slug"] == "south-america-subregion"
    assert areas[("subregion", "South America")]["_continent"] == "South America"
    assert areas[("continent", "South America")]["_blocks"] == ["MERCOSUR"]
    assert areas[("subregion", "Western Europe")]["_countries"] == ["FR"]


def test_types_carry_scope_note_and_deprecation():
    release = SimpleNamespace(blocktypes=[
        {"id": "intorg", "name": "International organization", "description": "Deprecated.",
         "deprecated": {"replacements": [], "removal": "next MAJOR", "note": "Use scope_category."}, "other_names": None},
        {"id": "fisheries", "name": "Fisheries", "description": None, "deprecated": None, "other_names": []},
    ])
    blocks = [{"id": "NAFO", "name": "NAFO", "blocktype": ["fisheries", "intorg"], "_active": True, "founded": "1979"}]
    types = {t["id"]: t for t in derive_types(release, blocks)}
    assert types["intorg"]["deprecated"]["removal"] == "next MAJOR"
    assert types["intorg"]["_primary_count"] == 0 and types["intorg"]["_count"] == 1
    assert types["fisheries"]["description"] is None and types["fisheries"]["deprecated"] is None
    assert types["fisheries"]["_primary_count"] == 1
