import pytest

from derive import (
    DeriveError,
    check_current_rule,
    classify_aliases,
    derive_blocks,
    derive_countries,
    include_is_current,
    primary_acronym,
)
from release import Release


def make_release(**overrides) -> Release:
    countries = [
        {"code": "DE", "name": "Germany", "iso3code": "DEU", "borders": ["FRA", "XXX"]},
        {"code": "FR", "name": "France", "iso3code": "FRA", "borders": ["DEU"]},
        {"code": "HK", "name": "Hong Kong SAR, China", "iso3code": "HKG", "parent_entity": {"code": "CN"}},
    ]
    intblocks = [
        {
            "id": "EU",
            "name": "European Union",
            "blocktype": ["economic", "political"],
            "status": "formal",
            "acronyms": [{"lang": "fr", "value": "UE"}, {"lang": "en", "value": "EU"}],
            "includes": [
                {"id": "DE", "type": "country", "status": "founding_member"},
                {"id": "FR", "type": "country", "status": "member"},
                {"id": "GB", "type": "country", "status": "former_member", "left": "2020-01-31"},
                {"id": "WEU", "type": "organization", "status": "member"},
            ],
        },
        {
            "id": "WEU",
            "name": "Western European Union",
            "blocktype": ["military"],
            "status": "historical",
            "dissolved": "2011",
            "partof": ["EU"],
            "includes": [
                {"id": "FR", "type": "country", "status": "member"},
                {"id": "DE", "type": "historical-country", "name": "German Democratic Republic", "status": "member"},
            ],
        },
        {"id": "BRICS", "name": "BRICS", "blocktype": ["economic"], "status": "informal",
         "acronyms": [{"lang": "en", "value": "BRICS"}], "includes": []},
    ]
    current = {("EU", "DE", "country"), ("EU", "FR", "country")}
    data = dict(
        countries=countries,
        intblocks=intblocks,
        blocktypes=[],
        memberships=[],
        current=current,
        statuses={},
        topics={},
        vocabs={},
        intblock_aliases=[
            {"alias": "OLD", "target": "EU", "reason": "merged", "since": "1.0.0"},
            {"alias": "BRICS", "target": "EU", "reason": "disambiguated", "since": "1.0.0"},
            {"alias": "AMB", "target": "EU", "reason": "disambiguated", "since": "1.0.0"},
            {"alias": "GONE", "target": None, "reason": "retired", "since": "1.0.0"},
        ],
        country_aliases=[
            {"alias": "KV", "target": "FR", "reason": "renamed", "since": "1.0.0"},
            {"alias": "KSV", "target": "FRA", "reason": "renamed", "since": "1.0.0"},
        ],
    )
    data.update(overrides)
    return Release(**data)


@pytest.mark.parametrize(
    ("include", "block", "expected"),
    [
        ({"status": "member"}, {"status": "formal"}, True),
        ({"status": "observer"}, {"status": "formal"}, True),
        ({"status": "former_member"}, {"status": "formal"}, False),
        ({"status": "member", "left": "2020"}, {"status": "formal"}, False),
        ({"status": "member"}, {"status": "historical"}, False),
        ({"status": "member"}, {"status": "formal", "dissolved": "1991"}, False),
    ],
)
def test_include_is_current(include, block, expected):
    assert include_is_current(include, block) is expected


def test_primary_acronym():
    eu, _, brics = make_release().intblocks
    assert primary_acronym(eu) == "EU"
    assert primary_acronym(brics) is None  # same as the name


def test_check_current_rule_accepts_matching_view():
    check_current_rule(make_release())


def test_check_current_rule_rejects_mismatch():
    with pytest.raises(DeriveError, match="disagrees"):
        check_current_rule(make_release(current={("EU", "DE", "country")}))


def test_classify_aliases():
    result = classify_aliases(make_release())
    kinds = {(p["section"], p["alias"]): p["kind"] for p in result["pages"]}
    assert kinds == {
        ("blocks", "OLD"): "redirect",
        ("blocks", "AMB"): "disambiguation",
        ("blocks", "GONE"): "retired",
        ("countries", "KV"): "redirect",
    }
    assert [n["kind"] for n in result["notes"][("blocks", "BRICS")]] == ["reused"]
    assert {n["alias"] for n in result["notes"][("blocks", "EU")]} == {"OLD", "BRICS", "AMB"}


def test_derive_blocks_roster_and_structure():
    release = make_release()
    blocks = {b["id"]: b for b in derive_blocks(release, {}, {})}
    eu = blocks["EU"]
    assert eu["_current_member_count"] == 2
    assert eu["_status_counts"] == {"founding_member": 1, "member": 1}
    assert [r["id"] for r in eu["_roster"]] == ["DE", "FR", "WEU", "GB"]  # current first, then by name
    assert {r["id"]: r["link"] for r in eu["_roster"]} == {"DE": "country", "FR": "country", "GB": None, "WEU": "block"}
    assert eu["_children"] == [{"id": "WEU", "name": "Western European Union", "exists": True}]
    assert eu["_source_path"] == "data/intblocks/economic/EU.yaml"

    weu = blocks["WEU"]
    assert weu["_active"] is False and weu["_current_member_count"] == 0
    gdr = next(r for r in weu["_roster"] if r["type"] == "historical-country")
    assert gdr["link"] is None  # DE here is the GDR, not Germany
    assert weu["_parents"] == [{"id": "EU", "name": "European Union", "exists": True}]


def test_derive_countries():
    countries = {c["code"]: c for c in derive_countries(make_release(), {}, {})}
    de = countries["DE"]
    assert de["_current_member_count"] == 1
    assert [m["block_id"] for m in de["_memberships"]] == ["EU"]  # GDR row of WEU is not Germany's
    assert de["_borders"] == [
        {"iso3code": "FRA", "code": "FR", "name": "France"},
        {"iso3code": "XXX", "code": None, "name": None},
    ]
    fr = countries["FR"]
    assert {m["block_id"]: m["current"] for m in fr["_memberships"]} == {"EU": True, "WEU": False}
    assert countries["HK"]["_parent_exists"] is False
