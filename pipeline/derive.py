"""Derived fields for country and intblock cards (SPEC §6.3, §6.5).

Every derived field starts with `_` so it can never be mistaken for an internacia-db export
field (SPEC §7.4, §12 guardrails). Record fields are passed through unchanged.
"""

from __future__ import annotations

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


def primary_acronym(block: dict) -> str | None:
    for acronym in block.get("acronyms") or []:
        value = acronym.get("value")
        if acronym.get("lang") == "en" and value and value != block.get("name"):
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
    Country aliases get pages only for alpha-2 codes, the key of country URLs.
    """
    block_ids = {b["id"] for b in release.intblocks}
    country_codes = {c["code"] for c in release.countries}
    pages, notes = [], defaultdict(list)

    for alias in release.intblock_aliases:
        old, target = alias["alias"], alias.get("target")
        entry = {**alias, "section": "blocks"}
        if old in block_ids:
            notes[("blocks", old)].append({**entry, "kind": "reused"})
        elif alias.get("reason") == "disambiguated":
            pages.append({**entry, "kind": "disambiguation"})
        elif not target or target not in block_ids:
            pages.append({**entry, "kind": "retired"})
        else:
            pages.append({**entry, "kind": "redirect"})
        if target in block_ids:
            notes[("blocks", target)].append({**entry, "kind": "former_id"})

    for alias in release.country_aliases:
        old, target = alias["alias"], alias.get("target")
        entry = {**alias, "section": "countries"}
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


def derive_countries(release: Release, similar: dict[str, list[dict]], alias_notes: dict) -> list[dict]:
    blocks = {b["id"]: b for b in release.intblocks}
    by_code = {c["code"]: c for c in release.countries}
    by_iso3 = {c["iso3code"]: c for c in release.countries if c.get("iso3code")}

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
            borders.append({"iso3code": iso3, "code": neighbour["code"] if neighbour else None,
                            "name": neighbour["name"] if neighbour else None})
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
            roster.append(
                {
                    "id": inc["id"],
                    "name": inc.get("name"),
                    "type": kind,
                    "status": inc.get("status"),
                    "joined": inc.get("joined"),
                    "left": inc.get("left"),
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
                "_source_path": _source_path_block(block),
            }
        )
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
    }
