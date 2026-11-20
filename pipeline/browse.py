"""Data for browse pages and statistics (SPEC §6.6–6.8, §8 V10).

Block types, topics and geography group the derived country and intblock records; statistics
measure field completeness and record counts. All values are computed from the release; nothing
here adds facts.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from itertools import combinations

from release import Release


def slugify(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")


def decade(value: str | None) -> int | None:
    """Decade of a founded/dissolved string such as 1949, 1949-04-04 or 1950s."""
    if not value:
        return None
    match = re.match(r"^(\d{3})\d", value)
    return int(match.group(1)) * 10 if match else None


def _block_row(b: dict) -> str:
    return b["id"]


def derive_types(release: Release, blocks: list[dict]) -> list[dict]:
    by_type = defaultdict(list)
    for b in blocks:
        for t in b["blocktype"]:
            by_type[t].append(b)
    out = []
    for bt in release.blocktypes:
        members = sorted(by_type.get(bt["id"], []), key=lambda b: (b["name"].casefold(), b["id"]))
        decades = Counter(d for b in members if (d := decade(b.get("founded"))) is not None)
        out.append(
            {
                "id": bt["id"],
                "name": bt["name"],
                # Scope note and deprecation (contract 4.1); a deprecated type stays valid in 4.x.
                "description": bt.get("description"),
                "deprecated": bt.get("deprecated"),
                "other_names": bt.get("other_names") or [],
                "_count": len(members),
                "_active_count": sum(1 for b in members if b["_active"]),
                "_primary_count": sum(1 for b in members if b["blocktype"][0] == bt["id"]),
                "_blocks": [_block_row(b) for b in members],
                "_founded_decades": {str(k): v for k, v in sorted(decades.items())},
                "_undated": sum(1 for b in members if decade(b.get("founded")) is None),
            }
        )
    return out


def derive_topics(release: Release, blocks: list[dict]) -> list[dict]:
    names: dict[str, str] = {}
    by_topic = defaultdict(list)
    pairs = Counter()
    for b in blocks:
        keys = []
        for t in b.get("topics") or []:
            key = t.get("key")
            if not key:
                continue
            names.setdefault(key, release.topics.get(key) or t.get("name") or key)
            by_topic[key].append(b)
            keys.append(key)
        for a, c in combinations(sorted(set(keys)), 2):
            pairs[(a, c)] += 1
    related = defaultdict(list)
    for (a, c), n in pairs.items():
        related[a].append((n, c))
        related[c].append((n, a))
    out = []
    for key in sorted(by_topic, key=lambda k: names[k].casefold()):
        members = sorted(by_topic[key], key=lambda b: (b["name"].casefold(), b["id"]))
        top = sorted(related.get(key, []), key=lambda x: (-x[0], names[x[1]].casefold()))[:10]
        out.append(
            {
                "key": key,
                "name": names[key],
                "_count": len(members),
                "_active_count": sum(1 for b in members if b["_active"]),
                "_blocks": [_block_row(b) for b in members],
                "_related": [{"key": k, "name": names[k], "shared": n} for n, k in top],
            }
        )
    return out


def derive_geography(countries: list[dict], blocks: list[dict]) -> list[dict]:
    """Continents and subregions (as the country records name them), with intblocks whose
    `regions` list the same label."""
    areas: dict[tuple[str, str], list[dict]] = defaultdict(list)
    sub_continent: dict[str, Counter] = defaultdict(Counter)
    for c in countries:
        for cont in c.get("continents") or []:
            areas[("continent", cont)].append(c)
        if c.get("subregion"):
            areas[("subregion", c["subregion"])].append(c)
            for cont in c.get("continents") or []:
                sub_continent[c["subregion"]][cont] += 1
    by_region = defaultdict(list)
    for b in blocks:
        for r in b.get("regions") or []:
            by_region[r.casefold()].append(b)

    out = []
    for (kind, label), members in sorted(areas.items(), key=lambda x: (x[0][0], x[0][1])):
        members = sorted(members, key=lambda c: c["name"].casefold())
        related = sorted(by_region.get(label.casefold(), []), key=lambda b: (not b["_active"], b["name"].casefold()))
        parent = sub_continent[label].most_common(1)[0][0] if kind == "subregion" and sub_continent[label] else None
        out.append(
            {
                "slug": slugify(label),
                "kind": kind,
                "name": label,
                "_continent": parent,
                "_countries": [c["code"] for c in members],
                "_iso_count": sum(1 for c in members if c.get("code_status") == "official_iso3166_1"),
                "_blocks": [b["id"] for b in related],
            }
        )
    slugs = Counter(a["slug"] for a in out)
    duplicates = [s for s, n in slugs.items() if n > 1]
    if duplicates:
        # A continent and a subregion can share a label (South America): keep both, disambiguate.
        for a in out:
            if a["slug"] in duplicates and a["kind"] == "subregion":
                a["slug"] = f"{a['slug']}-subregion"
    return out


def _filled(value) -> bool:
    if value is None:
        return False
    if isinstance(value, (list, dict, str)):
        return len(value) > 0
    return True


# Records the internacia-db validator does not count as missing a field (see the comments in
# *_completeness.yaml): empty by design, with a marker saying so.
EXEMPT = {
    "timezones": lambda r: bool(r.get("timezone_status")),
    "includes": lambda r: r.get("membership_applicability") == "not_applicable",
}


def completeness(records: list[dict], key: str, rules: dict[str, dict] | None = None) -> list[dict]:
    """Share of records with a value in each field. Fields that internacia-db gates
    (`*_completeness.yaml`) carry the gate: maximum null rate, mode and whether it is met.
    Other fields are optional or apply only to some records (for example `dissolved`)."""
    rules = rules or {}
    fields = sorted({k for r in records for k in r} | set(rules))
    rows = []
    for field in fields:
        exempt = EXEMPT.get(field, lambda r: False)
        missing = [r[key] for r in records if not _filled(r.get(field)) and not exempt(r)]
        share = round((len(records) - len(missing)) / len(records), 4) if records else 0
        row = {
            "field": field,
            "filled": len(records) - len(missing),
            "total": len(records),
            "share": share,
            "missing": missing,
        }
        rule = rules.get(field)
        if rule:
            max_null = float(rule.get("max_null_rate", 0))
            row["gate"] = {
                "max_null_rate": max_null,
                "mode": rule.get("mode"),
                "requirement": rule.get("requirement"),
                "priority": rule.get("priority"),
                "met": (1 - share) <= max_null + 1e-9,
            }
        rows.append(row)
    return sorted(rows, key=lambda r: ("gate" not in r, -r["share"], r["field"]))


def derive_stats(release: Release, blocks: list[dict]) -> dict:
    verified = Counter((b.get("last_verified") or "")[:7] or "never" for b in release.intblocks)
    decades = Counter(d for b in release.intblocks if (d := decade(b.get("founded"))) is not None)
    return {
        "countries": {
            "completeness": completeness(release.countries, "code", release.completeness_rules.get("countries")),
            "by_entity_type": dict(Counter(c.get("entity_type") for c in release.countries).most_common()),
            "by_code_status": dict(Counter(c.get("code_status") for c in release.countries).most_common()),
        },
        "intblocks": {
            "completeness": completeness(release.intblocks, "id", release.completeness_rules.get("intblocks")),
            "by_status": dict(Counter(b.get("status") for b in release.intblocks).most_common()),
            "by_scope_category": dict(Counter(b.get("scope_category") or "unclassified" for b in release.intblocks).most_common()),
            "by_geographic_scope": dict(Counter(b.get("geographic_scope") or "unclassified" for b in release.intblocks).most_common()),
            "founded_decades": {str(k): v for k, v in sorted(decades.items())},
            "last_verified_months": dict(sorted(verified.items())),
            "active": sum(1 for b in blocks if b["_active"]),
        },
        "memberships": {
            "by_status": dict(Counter(m["status"] for m in release.memberships).most_common()),
            "by_include_type": dict(Counter(m["include_type"] for m in release.memberships).most_common()),
            "with_joined": sum(1 for m in release.memberships if m.get("joined")),
            "with_left": sum(1 for m in release.memberships if m.get("left")),
            "by_role": dict(Counter(m["role"] for m in release.memberships if m.get("role")).most_common()),
        },
    }
