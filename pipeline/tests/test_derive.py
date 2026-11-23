import pytest

from derive import (
    DeriveError,
    border_status_by_pair,
    check_border_rule,
    check_current_rule,
    classify_aliases,
    derive_agreements,
    derive_blocks,
    derive_countries,
    derive_labels,
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
            {"alias": "DEFR", "target": "DEFR", "reason": "moved", "since": "5.0.0", "target_dataset": "trade_agreements"},
            {"alias": "LOST", "target": "LOST", "reason": "moved", "since": "5.0.0", "target_dataset": "trade_agreements"},
        ],
        country_aliases=[
            {"alias": "KV", "target": "FR", "reason": "renamed", "since": "1.0.0"},
            {"alias": "KSV", "target": "FRA", "reason": "renamed", "since": "1.0.0"},
        ],
    )
    # Trade agreements registry (contract 5.0): a moved two-party agreement, an agreement linked to
    # an intblock, a bloc party (EU, expanded by the view) and a superseded record.
    data["trade_agreements"] = [
        {"id": "DEFR", "name": "Germany-France Agreement", "agreement_type": "fta", "status": "in_force", "superseded_by": None, "supersedes": None, "intblock_id": None, "acronyms": []},
        {"id": "EUBR", "name": "EU-BRICS Agreement", "agreement_type": "fta", "status": "negotiating", "superseded_by": None, "supersedes": None, "intblock_id": None, "acronyms": []},
        {"id": "OLDFTA", "name": "Old Agreement", "agreement_type": "fta", "status": "superseded", "superseded_by": "DEFR", "supersedes": None, "intblock_id": None, "acronyms": []},
        {"id": "BRICS", "name": None, "agreement_type": "other", "status": "in_force", "superseded_by": None, "supersedes": None, "intblock_id": "BRICS", "acronyms": []},
    ]
    data["trade_agreement_parties"] = [
        {"agreement_id": "DEFR", "party_id": "DE", "party_type": "country", "status": "party", "source": "record"},
        {"agreement_id": "DEFR", "party_id": "FR", "party_type": "country", "status": "party", "source": "record"},
        {"agreement_id": "EUBR", "party_id": "EU", "party_type": "intblock", "status": "party", "source": "record"},
        {"agreement_id": "OLDFTA", "party_id": "FR", "party_type": "country", "status": "former_party", "left": "2000", "source": "record"},
    ]
    data["country_trade_agreements"] = [
        {"country_code": "DE", "agreement_id": "DEFR", "via": None, "agreement_type": "fta", "agreement_status": "in_force", "in_force": None},
        {"country_code": "DE", "agreement_id": "EUBR", "via": "EU", "agreement_type": "fta", "agreement_status": "negotiating", "in_force": None},
        {"country_code": "FR", "agreement_id": "DEFR", "via": None, "agreement_type": "fta", "agreement_status": "in_force", "in_force": None},
        {"country_code": "FR", "agreement_id": "EUBR", "via": "EU", "agreement_type": "fta", "agreement_status": "negotiating", "in_force": None},
    ]
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


@pytest.mark.parametrize(
    ("block", "expected"),
    [
        # Other languages' forms listed as English: pick the one matching the ID or the initials.
        ({"id": "AFUNION", "name": "African Union", "acronyms": [{"lang": "en", "value": "UA"}, {"lang": "en", "value": "AU"}]}, "AU"),
        ({"id": "UN", "name": "United Nations", "acronyms": [{"lang": "en", "value": "ONU"}, {"lang": "en", "value": "UN"}]}, "UN"),
        ({"id": "G-20", "name": "G-20 major economies", "acronyms": [{"lang": "en", "value": "G21"}, {"lang": "en", "value": "G-20"}]}, "G-20"),
        ({"id": "OECD", "name": "Organisation for Economic Co-operation and Development", "acronyms": [{"lang": "en", "value": "OECD"}]}, "OECD"),
        # No English acronym that fits the name: show none rather than a wrong one.
        ({"id": "XYZ", "name": "International Monetary Fund", "acronyms": [{"lang": "en", "value": "FMI"}]}, None),
        ({"id": "ASEAN", "name": "Association of SouthEast Asian Nations", "acronyms": []}, None),
    ],
)
def test_primary_acronym_resists_mislabelled_languages(block, expected):
    assert primary_acronym(block) == expected


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
        ("blocks", "DEFR"): "redirect",
        ("blocks", "LOST"): "retired",  # moved, but the registry has no such record
        ("countries", "KV"): "redirect",
    }
    sections = {p["alias"]: p["target_section"] for p in result["pages"]}
    assert sections["DEFR"] == "agreements" and sections["OLD"] == "blocks" and sections["KV"] == "countries"
    assert [n["kind"] for n in result["notes"][("agreements", "DEFR")]] == ["former_id"]
    assert [n["kind"] for n in result["notes"][("blocks", "BRICS")]] == ["reused"]
    assert {n["alias"] for n in result["notes"][("blocks", "EU")]} == {"OLD", "BRICS", "AMB"}


def test_derive_blocks_roster_and_structure():
    release = make_release()
    blocks = {b["id"]: b for b in derive_blocks(release, {}, {})}
    eu = blocks["EU"]
    assert eu["_current_member_count"] == 2
    assert eu["_status_counts"] == {"founding_member": 1, "member": 1}
    assert [r["id"] for r in eu["_roster"]] == ["FR", "DE", "WEU", "GB"]  # current first, then by name
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
        {"iso3code": "FRA", "code": "FR", "name": "France", "status": None, "border_status": None},
        {"iso3code": "XXX", "code": None, "name": None, "status": None, "border_status": None},
    ]
    fr = countries["FR"]
    assert {m["block_id"]: m["current"] for m in fr["_memberships"]} == {"EU": True, "WEU": False}
    assert countries["HK"]["_parent_exists"] is False


def test_roster_names_country_includes_from_country_record():
    blocks = {b["id"]: b for b in derive_blocks(make_release(), {}, {})}
    names = {r["id"]: r["name"] for r in blocks["EU"]["_roster"]}
    assert names["DE"] == "Germany"  # contract 4: name optional in source, the country's name
    assert names["GB"] is None  # no country record: nothing to fill in
    weu = {r["id"]: r["name"] for r in blocks["WEU"]["_roster"]}
    assert weu["DE"] == "German Democratic Republic"  # historical-country keeps its own name


def test_labels_carry_deprecated_statuses_and_native_name_languages():
    release = make_release(
        statuses={
            "associate_member": {"name": "Associate member"},
            "associate": {"name": "Associate", "deprecated": {"replacements": ["associate_member"]}},
        },
        native_name_languages={"prs": "Dari", "de": "German"},
    )
    labels = derive_labels(release)
    assert labels["statuses"]["associate"]["deprecated"] is True
    assert labels["statuses"]["associate_member"]["deprecated"] is False
    assert labels["native_name_languages"] == {"prs": "Dari", "de": "German"}


BORDER_ROW = {
    "country_a": "DEU", "country_b": "FRA", "status": "closed", "since": "1994", "until": None,
    "note": "Closed.", "last_verified": "2026-11-20",
    "provenance": [{"source": "Gov", "url": "https://example.org", "retrieved_at": "2026-11-20", "license": None}],
}


def test_border_status_on_both_cards():
    countries = {c["code"]: c for c in derive_countries(make_release(border_status=[BORDER_ROW]), {}, {})}
    de_fr = next(b for b in countries["DE"]["_borders"] if b["iso3code"] == "FRA")
    fr_de = next(b for b in countries["FR"]["_borders"] if b["iso3code"] == "DEU")
    assert de_fr["status"] == fr_de["status"] == "closed"
    assert de_fr["border_status"]["since"] == "1994"
    assert de_fr["border_status"]["provenance"][0]["source"] == "Gov"
    # No row: no closure recorded (not "open").
    assert next(b for b in countries["DE"]["_borders"] if b["iso3code"] == "XXX")["status"] is None


def test_ended_border_status_is_not_current():
    ended = {**BORDER_ROW, "until": "2001"}
    countries = {c["code"]: c for c in derive_countries(make_release(border_status=[ended]), {}, {})}
    de_fr = next(b for b in countries["DE"]["_borders"] if b["iso3code"] == "FRA")
    assert de_fr["status"] is None and de_fr["border_status"]["until"] == "2001"


@pytest.mark.parametrize(
    ("rows", "message"),
    [
        ([{**BORDER_ROW, "country_b": "HKG"}], "not a land border"),
        ([BORDER_ROW, {**BORDER_ROW, "country_a": "FRA", "country_b": "DEU"}], "twice"),
    ],
)
def test_border_status_rejects_bad_rows(rows, message):
    with pytest.raises(DeriveError, match=message):
        border_status_by_pair(make_release(border_status=rows))


# country_borders view rows for make_release(border_status=[BORDER_ROW]): DE borders FRA and XXX.
VIEW_CLOSED = {("DE", "FRA"): "closed", ("DE", "XXX"): None, ("FR", "DEU"): "closed"}


def test_check_border_rule_accepts_matching_view():
    check_border_rule(make_release(border_status=[BORDER_ROW], country_borders=VIEW_CLOSED))
    ended = {**BORDER_ROW, "until": "2001"}
    view_ended = {("DE", "FRA"): None, ("DE", "XXX"): None, ("FR", "DEU"): None}
    check_border_rule(make_release(border_status=[ended], country_borders=view_ended))


@pytest.mark.parametrize(
    "view",
    [
        {**VIEW_CLOSED, ("FR", "DEU"): "restricted"},
        {k: v for k, v in VIEW_CLOSED.items() if k != ("DE", "XXX")},
        {**VIEW_CLOSED, ("FR", "BEL"): None},
    ],
)
def test_check_border_rule_rejects_mismatch(view):
    with pytest.raises(DeriveError, match="country_borders view"):
        check_border_rule(make_release(border_status=[BORDER_ROW], country_borders=view))


def test_roles_on_roster_and_memberships():
    pipe = {
        "id": "PIPE", "name": "Pipe", "blocktype": ["gaspipeline"], "status": "formal",
        "includes": [
            {"id": "DE", "type": "country", "status": "member", "role": "destination"},
            {"id": "FR", "type": "country", "status": "member", "role": "origin"},
        ],
    }
    release = make_release()
    release.intblocks.append(pipe)
    blocks = {b["id"]: b for b in derive_blocks(release, {}, {})}
    assert {r["id"]: r["role"] for r in blocks["PIPE"]["_roster"]} == {"DE": "destination", "FR": "origin"}
    assert {r["id"]: r["role"] for r in blocks["EU"]["_roster"]} == {"DE": None, "FR": None, "GB": None, "WEU": None}
    countries = {c["code"]: c for c in derive_countries(release, {}, {})}
    assert {m["block_id"]: m["role"] for m in countries["FR"]["_memberships"]} == {"EU": None, "PIPE": "origin", "WEU": None}


def test_labels_carry_roles_and_institutional_design():
    release = make_release(
        include_roles={"transit": {"name": "Transit", "description": "Crosses.", "blocktypes": ["gaspipeline"]}},
        institutional_design={"mandate": {"name": "Mandate", "kind": "enum", "description": "", "values": {}}},
    )
    labels = derive_labels(release)
    assert labels["include_roles"]["transit"]["name"] == "Transit"
    assert labels["institutional_design"]["mandate"]["name"] == "Mandate"


def test_trade_agreements_on_cards():
    release = make_release()
    agreements = {a["id"]: a for a in derive_agreements(release, classify_aliases(release)["notes"])}
    defr = agreements["DEFR"]
    assert defr["_party_count"] == 2 and [p["link"] for p in defr["_parties"]] == ["country", "country"]
    assert [r["id"] for r in defr["_supersedes"]] == ["OLDFTA"]  # from OLDFTA's superseded_by
    assert defr["_alias_notes"][0]["alias"] == "DEFR"
    assert defr["_source_path"] == "data/trade_agreements/DEFR.yaml"
    eubr = agreements["EUBR"]
    assert eubr["_parties"][0]["link"] == "block" and eubr["_parties"][0]["name"] == "European Union"
    assert [c["code"] for c in eubr["_countries"]] == ["FR", "DE"]  # by name: France, Germany
    assert agreements["BRICS"]["_name"] == "BRICS"  # a linked record takes its intblock's name
    assert agreements["BRICS"]["_block"] == {"id": "BRICS", "name": "BRICS", "exists": True}
    assert agreements["OLDFTA"]["_superseded_by"] == {"id": "DEFR", "name": "Germany-France Agreement", "exists": True}

    countries = {c["code"]: c for c in derive_countries(release, {}, {})}
    fr = countries["FR"]
    assert [(r["agreement_id"], r["via"]) for r in fr["_trade_agreements"]] == [("DEFR", None), ("EUBR", "EU")]  # in force first
    assert fr["_trade_agreements"][1]["via_name"] == "European Union"
    assert [(r["agreement_id"], r["left"]) for r in fr["_former_trade_agreements"]] == [("OLDFTA", "2000")]
    assert countries["HK"]["_trade_agreements"] == []

    blocks = {b["id"]: b for b in derive_blocks(release, {}, {})}
    assert [r["agreement_id"] for r in blocks["EU"]["_party_to_agreements"]] == ["EUBR"]
    assert blocks["BRICS"]["_trade_agreement"]["agreement_id"] == "BRICS"
    assert blocks["EU"]["_trade_agreement"] is None


def test_trade_agreement_parties_must_name_known_agreements():
    release = make_release()
    release.trade_agreement_parties.append({"agreement_id": "NOPE", "party_id": "FR", "party_type": "country", "status": "party"})
    with pytest.raises(DeriveError, match="unknown agreements"):
        derive_agreements(release, {})
