#!/usr/bin/env python3
"""Resolve club home grounds from Wikidata P115. Does not invent names.

Usage:
  python3 fetch_stadium_names.py clubs.json known-stadiums.json > stadiums.json

clubs.json is the Crest PWA bundle (slug, name, city, stadiumName).
known-stadiums.json is the already-checked list; those names win.
"""

from __future__ import annotations

import json
import sys
import time

import requests

UA = "TheReflectiveFootball/1.0 (stadium name research; https://thereflectivefootball.com)"
WD_API = "https://www.wikidata.org/w/api.php"
SLEEP = 0.35

FOOTBALL_HINTS = (
    "football club",
    "soccer club",
    "association football",
    "calcio",
    "football team",
    "soccer team",
)


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    return s


def search_wikidata(s: requests.Session, term: str) -> list[dict]:
    r = s.get(
        WD_API,
        params={
            "action": "wbsearchentities",
            "search": term,
            "language": "en",
            "type": "item",
            "limit": 8,
            "format": "json",
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("search") or []


def entity(s: requests.Session, qid: str) -> dict:
    r = s.get(
        WD_API,
        params={
            "action": "wbgetentities",
            "ids": qid,
            "props": "labels|claims|descriptions",
            "languages": "en",
            "format": "json",
        },
        timeout=30,
    )
    r.raise_for_status()
    return (r.json().get("entities") or {}).get(qid) or {}


def preferred_claim_ids(ent: dict, pid: str) -> list[str]:
    out = []
    for c in (ent.get("claims") or {}).get(pid, []):
        rank = c.get("rank")
        if rank == "deprecated":
            continue
        mainsnak = c.get("mainsnak") or {}
        datavalue = mainsnak.get("datavalue") or {}
        value = datavalue.get("value") or {}
        qid = value.get("id")
        if qid:
            out.append((0 if rank == "preferred" else 1, qid))
    out.sort()
    return [qid for _, qid in out]


def label_en(ent: dict) -> str:
    block = (ent.get("labels") or {}).get("en") or {}
    return (block.get("value") or "").strip()


def pick_club_qid(hits: list[dict], name: str) -> str | None:
    name_l = name.lower()
    scored = []
    for h in hits:
        label = (h.get("label") or "").lower()
        desc = (h.get("description") or "").lower()
        if any(k in desc for k in FOOTBALL_HINTS) or "football" in desc or "soccer" in desc:
            score = 2
            if name_l and (name_l in label or label in name_l):
                score += 2
            if "women" in desc or "women's" in label:
                score -= 3
            if "basketball" in desc or "futsal" in desc:
                score -= 4
            scored.append((score, h.get("id")))
    scored.sort(reverse=True)
    if scored and scored[0][0] > 0:
        return scored[0][1]
    return None


def resolve_club(s: requests.Session, club: dict) -> dict | None:
    slug = club["slug"]
    name = club.get("common_name") or club.get("name") or slug
    city = (club.get("city") or "").strip()
    country = (club.get("country") or "").strip()
    terms = [name, f"{name} football club"]
    if city and city.lower() not in {"unknown", "your city"}:
        terms.append(f"{name} {city}")
    if country:
        terms.append(f"{name} {country}")

    qid = None
    for term in terms:
        hits = search_wikidata(s, term)
        time.sleep(SLEEP)
        qid = pick_club_qid(hits, name)
        if qid:
            break
    if not qid:
        return None

    club_ent = entity(s, qid)
    time.sleep(SLEEP)
    venues = preferred_claim_ids(club_ent, "P115")
    if not venues:
        return None
    stadium_ent = entity(s, venues[0])
    time.sleep(SLEEP)
    stadium_name = label_en(stadium_ent)
    if not stadium_name:
        return None

    if not city or city.lower() in {"unknown", "your city"}:
        places = preferred_claim_ids(stadium_ent, "P131")
        if places:
            place_ent = entity(s, places[0])
            time.sleep(SLEEP)
            city = label_en(place_ent) or city

    return {
        "slug": slug,
        "city": city or "",
        "stadiumName": stadium_name,
        "wikidataClub": qid,
        "wikidataStadium": venues[0],
        "source": "wikidata-p115",
    }


def usable_name(value: str | None) -> bool:
    name = (value or "").strip()
    return bool(name) and name.lower() not in {"home ground", "unknown"}


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "Usage: fetch_stadium_names.py clubs.json known-stadiums.json",
            file=sys.stderr,
        )
        return 2

    clubs = json.loads(open(sys.argv[1], encoding="utf-8").read())
    known_rows = json.loads(open(sys.argv[2], encoding="utf-8").read())
    known = {row["slug"]: row for row in known_rows}

    s = session()
    out = []
    missing = []

    for i, club in enumerate(clubs, 1):
        slug = club.get("slug")
        if not slug:
            continue
        print(f"[{i}/{len(clubs)}] {slug}", file=sys.stderr)

        if slug in known and usable_name(known[slug].get("stadiumName")):
            row = {
                "slug": slug,
                "city": known[slug].get("city") or club.get("city") or "",
                "stadiumName": known[slug]["stadiumName"],
                "source": "known",
            }
            out.append(row)
            print(f"  → known {row['stadiumName']}", file=sys.stderr)
            continue

        if usable_name(club.get("stadiumName")):
            row = {
                "slug": slug,
                "city": club.get("city") or "",
                "stadiumName": club["stadiumName"].strip(),
                "source": "clubs-json",
            }
            out.append(row)
            print(f"  → clubs.json {row['stadiumName']}", file=sys.stderr)
            continue

        resolved = resolve_club(s, club)
        if resolved:
            out.append(resolved)
            print(f"  → {resolved['stadiumName']}", file=sys.stderr)
        else:
            missing.append(slug)
            print("  → not_found", file=sys.stderr)

    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
    print(file=sys.stdout)
    print(f"resolved {len(out)} / {len(clubs)}; missing {len(missing)}", file=sys.stderr)
    if missing:
        print("MISSING", file=sys.stderr)
        for slug in missing:
            print(slug, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
