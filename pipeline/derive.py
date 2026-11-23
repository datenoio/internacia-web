"""Derived fields for country and intblock cards (SPEC §6.3, §6.5).

Every derived field starts with `_` so it can never be mistaken for an internacia-db export
field (SPEC §7.4, §12 guardrails). Record fields are passed through unchanged.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict

from release import Release

# Include types that refer to a country record (contract: memberships.include_type).
COUNTRY_TYPES = ("country", "territory")


class DeriveError(RuntimeError):
    """Derived data disagrees with the release."""


def block_is_active(block: dict) -> bool:
    return block.get("status") != "historical" and not block.get("dissolved")


def include_is_current(include: dict, block: dict) -> bool:
    """Same rule as the current_memberships view in contract.json (SPEC §4.4)."""
    return include.get("status") != "former_member" and not include.get("left") and block_is_active(block)


_STOPWORDS = {"of", "the", "and", "for", "in", "on", "to", "de", "la", "du", "des", "et", "y"}


def _letters(text: str) -> str:
    return "".join(ch for ch in text.upper() if ch.isalnum())


def _initials(name: str) -> str:
    words = [w for w in re.split(r"[\s\-–/]+", name) if w and w.lower() not in _STOPWORDS]
    return "".join(w[0] for w in words).upper()


def _is_subsequence(short: str, long: str) -> bool:
    it = iter(long)
    return all(ch in it for ch in short)


def primary_acronym(block: dict) -> str | None:
    """The English acronym to show next to the name, or None.

    `lang: en` acronyms in the data also hold other languages' forms (the African Union lists
    "UA" first, the UN "ONU"), so the first one is not reliable. In order of preference: an
    acronym equal to the ID; one equal to the initials of the name; the first English one whose
    letters appear in order in the name, starting with its first letter.
    """
    name = block.get("name") or ""
    english = [a["value"] for a in block.get("acronyms") or [] if a.get("lang") == "en" and a.get("value")]
    every = [a["value"] for a in block.get("acronyms") or [] if a.get("value")]
    english = [v for v in english if v != name]
    key = _letters(block.get("id", ""))
    for value in every:
        if _letters(value) == key and value != name:
            return value
    initials = _initials(name)
    for value in english:
        if _letters(value) == initials:
            return value
    name_letters = _letters(name)
    for value in english:
        letters = _letters(value)
        if letters and name_letters.startswith(letters[0]) and _is_subsequence(letters, name_letters):
            return value
    return None


def _source_path_country(code: str) -> str:
    return f"data/countries/{code}.yaml"


def _source_path_block(block: dict) -> str:
    return f"data/intblocks/{block['blocktype'][0]}/{block['id']}.yaml"


def check_current_rule(release: Release) -> None:
    """Fail if include_is_current disagrees with the release's current_memberships view."""
    computed = {
        (block["id"], inc["id"], inc["type"])
        for block in release.intblocks
        for inc in block.get("includes") or []
        if inc.get("type") in (*COUNTRY_TYPES, "historical-country") and include_is_current(inc, block)
    }
    if computed != release.current:
        extra, missing = computed - release.current, release.current - computed
        raise DeriveError(
            f"current-membership rule disagrees with the current_memberships view: "
            f"{len(extra)} extra (e.g. {sorted(extra)[:3]}), {len(missing)} missing (e.g. {sorted(missing)[:3]})"
        )


def classify_aliases(release: Release) -> dict:
    """Decide what each retired or renamed ID becomes on the site (SPEC §5.3).

    - ID reused by a current record: no page; a note on that record's card.
    - reason "disambiguated": a disambiguation page, never a redirect.
    - no target (retired): a "retired ID" page.
    - otherwise: a redirect page to the target.
    An intblock alias with target_dataset "trade_agreements" (reason "moved", contract 5.0) points
    to a trade agreement card under the same ID: its old intblock URLs redirect there, and the
    agreement card notes the former record. `target_section` names the section of the target.
    Country aliases get pages only for alpha-2 codes, the key of country URLs.
    """
    block_ids = {b["id"] for b in release.intblocks}
    agreement_ids = {a["id"] for a in release.trade_agreements}
    country_codes = {c["code"] for c in release.countries}
    pages, notes = [], defaultdict(list)

    for alias in release.intblock_aliases:
        old, target = alias["alias"], alias.get("target")
        to_registry = alias.get("target_dataset") == "trade_agreements"
        section, known = ("agreements", agreement_ids) if to_registry else ("blocks", block_ids)
        entry = {**alias, "section": "blocks", "target_section": section}
        if old in block_ids:
            notes[("blocks", old)].append({**entry, "kind": "reused"})
        elif alias.get("reason") == "disambiguated":
            pages.append({**entry, "kind": "disambiguation"})
        elif not target or target not in known:
            pages.append({**entry, "kind": "retired"})
        else:
            pages.append({**entry, "kind": "redirect"})
        if target in known:
            notes[(section, target)].append({**entry, "kind": "former_id"})

    for alias in release.country_aliases:
        old, target = alias["alias"], alias.get("target")
        entry = {**alias, "section": "countries", "target_section": "countries"}
        if len(old) != 2:
            continue
        if old in country_codes:
            notes[("countries", old)].append({**entry, "kind": "reused"})
        elif target in country_codes:
            pages.append({**entry, "kind": "redirect"})
            notes[("countries", target)].append({**entry, "kind": "former_id"})
        else:
            pages.append({**entry, "kind": "retired"})

    return {"pages": pages, "notes": notes}


def border_status_by_pair(release: Release) -> dict[frozenset, dict]:
    """border_status rows keyed on their alpha-3 pair (SPEC §4.4). Fail if a row names a pair
    that is not a land border on both country records, or if a pair has two rows."""
    by_iso3 = {c["iso3code"]: c for c in release.countries if c.get("iso3code")}
    pairs = {}
    for row in release.border_status:
        a, b = row["country_a"], row["country_b"]
        if b not in (by_iso3.get(a, {}).get("borders") or []) or a not in (by_iso3.get(b, {}).get("borders") or []):
            raise DeriveError(f"border_status {a}-{b} is not a land border on both country records")
        key = frozenset((a, b))
        if key in pairs:
            raise DeriveError(f"border_status lists {a}-{b} twice")
        pairs[key] = row
    return pairs


def border_is_current(row: dict | None) -> bool:
    """Same rule as the country_borders view in contract.json: a row without `until` is current."""
    return bool(row) and not row.get("until")


def check_border_rule(release: Release) -> None:
    """Fail if border_is_current disagrees with the release's country_borders view: the current
    status of every (country, land neighbour) pair, or None when no closure is recorded."""
    rows = border_status_by_pair(release)
    computed = {}
    for country in release.countries:
        for iso3 in country.get("borders") or []:
            row = rows.get(frozenset((country.get("iso3code"), iso3)))
            computed[(country["code"], iso3)] = row["status"] if border_is_current(row) else None
    if computed != release.country_borders:
        view, absent = release.country_borders, object()
        differ = sorted(k for k in computed.keys() | view.keys() if computed.get(k, absent) != view.get(k, absent))
        raise DeriveError(
            f"border-status rule disagrees with the country_borders view on {len(differ)} pairs (e.g. {differ[:3]})"
        )


def _border_entry(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "status": row.get("status"),
        "since": row.get("since"),
        "until": row.get("until"),
        "note": row.get("note"),
        "last_verified": row.get("last_verified"),
        "provenance": row.get("provenance") or [],
    }


def derive_countries(release: Release, similar: dict[str, list[dict]], alias_notes: dict) -> list[dict]:
    blocks = {b["id"]: b for b in release.intblocks}
    by_code = {c["code"]: c for c in release.countries}
    by_iso3 = {c["iso3code"]: c for c in release.countries if c.get("iso3code")}
    border_rows = border_status_by_pair(release)
    trade = country_trade_agreements(release)

    memberships = defaultdict(list)
    for block in release.intblocks:
        for inc in block.get("includes") or []:
            if inc.get("type") not in COUNTRY_TYPES:
                continue
            memberships[inc["id"]].append(
                {
                    "block_id": block["id"],
                    "block_name": block["name"],
                    "acronym": primary_acronym(block),
                    "blocktype": block["blocktype"][0],
                    "block_status": block.get("status"),
                    "status": inc.get("status"),
                    "joined": inc.get("joined"),
                    "left": inc.get("left"),
                    "role": inc.get("role"),
                    "note": inc.get("note"),
                    "current": include_is_current(inc, block),
                }
            )

    dependents = defaultdict(list)
    for c in release.countries:
        parent = (c.get("parent_entity") or {}).get("code")
        if parent:
            dependents[parent].append({"code": c["code"], "name": c["name"]})

    out = []
    for country in sorted(release.countries, key=lambda c: c["code"]):
        code = country["code"]
        rows = sorted(memberships.get(code, []), key=lambda m: (m["block_name"].casefold(), m["block_id"]))
        current = [m for m in rows if m["current"]]
        borders = []
        for iso3 in country.get("borders") or []:
            neighbour = by_iso3.get(iso3)
            row = border_rows.get(frozenset((country["iso3code"], iso3)))
            borders.append(
                {
                    "iso3code": iso3,
                    "code": neighbour["code"] if neighbour else None,
                    "name": neighbour["name"] if neighbour else None,
                    # Current crossing status (closed, restricted) or None when no closure is
                    # recorded, which does not mean the border is verified open.
                    "status": row["status"] if border_is_current(row) else None,
                    "border_status": _border_entry(row),
                }
            )
        parent = (country.get("parent_entity") or {}).get("code")
        out.append(
            {
                **country,
                "_current_member_count": len(current),
                "_status_counts": dict(Counter(m["status"] for m in current).most_common()),
                "_blocktype_counts": dict(Counter(m["blocktype"] for m in current).most_common()),
                "_memberships": rows,
                "_similar": similar.get(code, []),
                "_borders": borders,
                "_parent_exists": bool(parent and parent in by_code),
                "_dependents": sorted(dependents.get(code, []), key=lambda d: d["name"]),
                "_alias_notes": alias_notes.get(("countries", code), []),
                # Trade agreements registry (contract 5.0); current coverage, blocs expanded.
                "_trade_agreements": trade.get(code, {}).get("current", []),
                "_former_trade_agreements": trade.get(code, {}).get("former", []),
                "_source_path": _source_path_country(code),
            }
        )
    # Guard: membership rows must only reference known blocks.
    unknown = {m["block_id"] for rows in memberships.values() for m in rows} - set(blocks)
    if unknown:
        raise DeriveError(f"memberships reference unknown intblocks: {sorted(unknown)[:5]}")
    return out


def derive_blocks(release: Release, similar: dict[str, list[dict]], alias_notes: dict) -> list[dict]:
    blocks = {b["id"]: b for b in release.intblocks}
    countries = {c["code"]: c for c in release.countries}
    trade = block_trade_agreements(release)

    children = defaultdict(dict)
    for block in release.intblocks:
        for parent in block.get("partof") or []:
            children[parent][block["id"]] = block["name"]
        for sub in block.get("suborganizations") or []:
            children[block["id"]].setdefault(sub["id"], sub.get("name"))

    def ref(block_id: str | None) -> dict | None:
        if not block_id:
            return None
        known = blocks.get(block_id)
        return {"id": block_id, "name": known["name"] if known else None, "exists": known is not None}

    out = []
    for block in sorted(release.intblocks, key=lambda b: b["id"]):
        active = block_is_active(block)
        roster = []
        for inc in block.get("includes") or []:
            kind = inc.get("type")
            if kind in COUNTRY_TYPES:
                link = "country" if inc["id"] in countries else None
            elif kind == "organization":
                link = "block" if inc["id"] in blocks else None
            else:  # historical-country: the code may now name a different, current country
                link = None
            # Contract 4: a country include's name is the country's name, filled by the export.
            name = inc.get("name") or (countries[inc["id"]]["name"] if link == "country" else None)
            roster.append(
                {
                    "id": inc["id"],
                    "name": name,
                    "type": kind,
                    "status": inc.get("status"),
                    "joined": inc.get("joined"),
                    "left": inc.get("left"),
                    "role": inc.get("role"),
                    "note": inc.get("note"),
                    "current": include_is_current(inc, block),
                    "link": link,
                    "flag_emoji": countries[inc["id"]].get("flag_emoji") if link == "country" else None,
                }
            )
        roster.sort(key=lambda r: (not r["current"], (r["name"] or r["id"]).casefold()))
        current_countries = [r for r in roster if r["current"] and r["type"] in COUNTRY_TYPES]
        out.append(
            {
                **block,
                "_acronym": primary_acronym(block),
                "_active": active,
                "_current_member_count": len(current_countries),
                "_status_counts": dict(Counter(r["status"] for r in current_countries).most_common()),
                "_roster": roster,
                "_parents": [ref(p) for p in block.get("partof") or []],
                "_children": [
                    {"id": cid, "name": name or (blocks[cid]["name"] if cid in blocks else None), "exists": cid in blocks}
                    for cid, name in sorted(children.get(block["id"], {}).items())
                ],
                "_predecessor": ref(block.get("predecessor")),
                "_successor": ref(block.get("successor")),
                "_similar": similar.get(block["id"], []),
                "_hq_country_name": countries.get((block.get("headquarters") or {}).get("country"), {}).get("name"),
                "_alias_notes": alias_notes.get(("blocks", block["id"]), []),
                # Trade agreements registry (contract 5.0): the record linked to this intblock,
                # and the agreements it is a party to as a bloc.
                "_trade_agreement": trade[block["id"]]["linked"],
                "_party_to_agreements": trade[block["id"]]["party"],
                "_source_path": _source_path_block(block),
            }
        )
    return out


# Trade agreement statuses in the order cards list them (contract 5.0; open enum: an unknown
# status sorts last). `suspended` (contract 5.1): negotiations on hold, not formally ended.
AGREEMENT_STATUS_ORDER = ("in_force", "signed", "negotiating", "suspended", "proposed", "terminated", "superseded", "abandoned")


def _agreement_status_rank(status: str | None) -> int:
    return AGREEMENT_STATUS_ORDER.index(status) if status in AGREEMENT_STATUS_ORDER else len(AGREEMENT_STATUS_ORDER)


def _source_path_agreement(agreement: dict) -> str:
    return f"data/trade_agreements/{agreement['id']}.yaml"


def _agreement_name(agreement: dict, blocks: dict[str, dict]) -> str:
    """The record's name; a linked record without one takes its intblock's name (contract 5.0:
    a record with `intblock` set has no name of its own in the source)."""
    return agreement.get("name") or (blocks.get(agreement.get("intblock_id") or "") or {}).get("name") or agreement["id"]


def _agreement_row(agreement: dict, blocks: dict[str, dict]) -> dict:
    """The facts a country or intblock card lists for one agreement."""
    return {
        "agreement_id": agreement["id"],
        "name": _agreement_name(agreement, blocks),
        "acronym": primary_acronym(agreement),
        "agreement_type": agreement.get("agreement_type"),
        "status": agreement.get("status"),
        "signed": agreement.get("signed"),
        # Contract 5.1: in_force is the definitive entry into force; an agreement applied only
        # provisionally has provisional_application and no in_force.
        "provisional_application": agreement.get("provisional_application"),
        "in_force": agreement.get("in_force"),
        "ended": agreement.get("ended"),
        "verification": agreement.get("verification"),
    }


def _sort_agreements(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda r: (_agreement_status_rank(r["status"]), r["name"].casefold(), r["agreement_id"]))


def country_trade_agreements(release: Release) -> dict[str, dict[str, list[dict]]]:
    """Trade agreements of each country (contract 5.0).

    `current` rows are the country_trade_agreements view: one per agreement the country is a
    current party to, directly (`via` None) or through a bloc that is a party (`via` = bloc ID,
    expanded to the bloc's current members), whatever the agreement's own status. Coverage is
    current, not historical. `former` rows are the country's own `former_party` entries.
    `role` (contract 5.1) is grantor or beneficiary on a preference scheme and party on every
    other agreement; the view's dates are the country's own where its party row has them.
    """
    blocks = {b["id"]: b for b in release.intblocks}
    agreements = {a["id"]: a for a in release.trade_agreements}
    out: dict[str, dict[str, list[dict]]] = defaultdict(lambda: {"current": [], "former": []})
    for row in release.country_trade_agreements:
        a = agreements[row["agreement_id"]]
        via = row.get("via")
        out[row["country_code"]]["current"].append(
            {
                **_agreement_row(a, blocks),
                "role": row.get("role"),
                "party_provisional_application": row.get("provisional_application"),
                "party_in_force": row.get("in_force"),
                "via": via,
                "via_name": blocks[via]["name"] if via in blocks else None,
            }
        )
    current = {(k, r["agreement_id"]) for k, v in out.items() for r in v["current"]}
    for p in release.trade_agreement_parties:
        if p.get("party_type") in COUNTRY_TYPES and p.get("status") == "former_party" and (p["party_id"], p["agreement_id"]) not in current:
            out[p["party_id"]]["former"].append(
                {**_agreement_row(agreements[p["agreement_id"]], blocks), "role": p.get("role"), "joined": p.get("joined"), "left": p.get("left")}
            )
    return {k: {"current": _sort_agreements(v["current"]), "former": _sort_agreements(v["former"])} for k, v in out.items()}


def block_trade_agreements(release: Release) -> dict[str, dict]:
    """For each intblock: the registry record linked to it (`intblock_id`) and the agreements it
    is a party to as a bloc (the EU, EAEU). Contract 5.0."""
    blocks = {b["id"]: b for b in release.intblocks}
    agreements = {a["id"]: a for a in release.trade_agreements}
    linked: dict[str, dict] = {}
    for a in release.trade_agreements:
        if a.get("intblock_id"):
            linked[a["intblock_id"]] = {**_agreement_row(a, blocks), "wto_rta_id": a.get("wto_rta_id")}
    parties: dict[str, list[dict]] = defaultdict(list)
    for p in release.trade_agreement_parties:
        if p.get("party_type") == "intblock":
            parties[p["party_id"]].append(
                {**_agreement_row(agreements[p["agreement_id"]], blocks), "role": p.get("role"), "party_status": p.get("status")}
            )
    return {
        bid: {"linked": linked.get(bid), "party": _sort_agreements(parties.get(bid, []))}
        for bid in blocks
    }


def derive_agreements(release: Release, alias_notes: dict) -> list[dict]:
    """Trade agreement cards (contract 5.0): registry records with resolved parties.

    `_parties` are the trade_agreement_parties rows (a linked record's parties come from its
    intblock's includes, `source = intblock`). `_countries` are the country_trade_agreements view's
    rows for the agreement: current coverage, with a bloc party expanded to its current members.
    Contract 5.1: parties carry `role` and `provisional_application`; `_instruments` are the
    trade_agreement_instruments rows (protocols, supplements, joint committee decisions); `_parent`
    and `_children` link a preference sub-scheme and its scheme (`parent`).
    """
    blocks = {b["id"]: b for b in release.intblocks}
    countries = {c["code"]: c for c in release.countries}
    agreements = {a["id"]: a for a in release.trade_agreements}

    parties: dict[str, list[dict]] = defaultdict(list)
    for p in release.trade_agreement_parties:
        kind = p.get("party_type")
        if kind in COUNTRY_TYPES:
            link = "country" if p["party_id"] in countries else None
        elif kind == "intblock":
            link = "block" if p["party_id"] in blocks else None
        else:  # historical-country: the code may now name a different, current country
            link = None
        name = (countries if link == "country" else blocks if link == "block" else {}).get(p["party_id"], {}).get("name")
        parties[p["agreement_id"]].append(
            {
                "id": p["party_id"],
                "name": name,
                "type": kind,
                "role": p.get("role"),
                "status": p.get("status"),
                "signed": p.get("signed"),
                "provisional_application": p.get("provisional_application"),
                "in_force": p.get("in_force"),
                "joined": p.get("joined"),
                "left": p.get("left"),
                "note": p.get("note"),
                "source": p.get("source"),
                "link": link,
                "flag_emoji": countries[p["party_id"]].get("flag_emoji") if link == "country" else None,
            }
        )
    covered: dict[str, list[dict]] = defaultdict(list)
    for row in release.country_trade_agreements:
        c = countries.get(row["country_code"], {})
        covered[row["agreement_id"]].append(
            {
                "code": row["country_code"],
                "name": c.get("name"),
                "flag_emoji": c.get("flag_emoji"),
                "via": row.get("via"),
                "role": row.get("role"),
                "provisional_application": row.get("provisional_application"),
                "in_force": row.get("in_force"),
            }
        )

    def block_ref(block_id: str | None) -> dict | None:
        if not block_id:
            return None
        return {"id": block_id, "name": blocks[block_id]["name"] if block_id in blocks else None, "exists": block_id in blocks}

    def agreement_ref(agreement_id: str | None) -> dict | None:
        if not agreement_id:
            return None
        known = agreements.get(agreement_id)
        return {"id": agreement_id, "name": _agreement_name(known, blocks) if known else None, "exists": known is not None}

    replaced: dict[str, list[str]] = defaultdict(list)
    children: dict[str, list[str]] = defaultdict(list)
    for x in release.trade_agreements:
        if x.get("superseded_by"):
            replaced[x["superseded_by"]].append(x["id"])
        if x.get("parent"):
            children[x["parent"]].append(x["id"])
    instruments: dict[str, list[dict]] = defaultdict(list)
    for row in release.trade_agreement_instruments:
        instruments[row["agreement_id"]].append({k: v for k, v in row.items() if k != "agreement_id"})

    out = []
    for a in sorted(release.trade_agreements, key=lambda x: x["id"]):
        rows = sorted(parties.get(a["id"], []), key=lambda r: (r["status"] != "party", (r["name"] or r["id"]).casefold()))
        out.append(
            {
                **a,
                "_name": _agreement_name(a, blocks),
                "_acronym": primary_acronym(a),
                "_party_count": sum(1 for r in rows if r["status"] == "party"),
                "_parties": rows,
                "_countries": sorted(covered.get(a["id"], []), key=lambda r: ((r["name"] or r["code"]).casefold(), r["code"])),
                "_block": block_ref(a.get("intblock_id")),
                # Records this one replaced: its own `supersedes` and every record whose
                # `superseded_by` names it (most records set only one side).
                "_supersedes": [agreement_ref(x) for x in sorted({*([a["supersedes"]] if a.get("supersedes") else []), *replaced.get(a["id"], [])})],
                "_superseded_by": agreement_ref(a.get("superseded_by")),
                "_parent": agreement_ref(a.get("parent")),
                "_children": sorted(
                    (agreement_ref(x) for x in children.get(a["id"], [])), key=lambda r: ((r["name"] or r["id"]).casefold(), r["id"])
                ),
                "_instruments": instruments.get(a["id"], []),
                "_alias_notes": alias_notes.get(("agreements", a["id"]), []),
                "_source_path": _source_path_agreement(a),
            }
        )
    unknown = {p["agreement_id"] for p in release.trade_agreement_parties} - set(agreements)
    if unknown:
        raise DeriveError(f"trade_agreement_parties reference unknown agreements: {sorted(unknown)[:5]}")
    unknown = {r["agreement_id"] for r in release.trade_agreement_instruments} - set(agreements)
    if unknown:
        raise DeriveError(f"trade_agreement_instruments reference unknown agreements: {sorted(unknown)[:5]}")
    return out


def derive_blocktypes(release: Release) -> list[dict]:
    counts = Counter(t for b in release.intblocks for t in b.get("blocktype") or [])
    return [{**bt, "_count": counts.get(bt["id"], 0)} for bt in release.blocktypes]


def derive_labels(release: Release) -> dict:
    return {
        "statuses": {
            key: {
                "name": value.get("name", key),
                "description": " ".join(str(value.get("description", "")).split()),
                "deprecated": "deprecated" in value,
            }
            for key, value in release.statuses.items()
        },
        "topics": release.topics,
        "vocabs": release.vocabs,
        "native_name_languages": release.native_name_languages,
        "include_roles": release.include_roles,
        "institutional_design": release.institutional_design,
    }
