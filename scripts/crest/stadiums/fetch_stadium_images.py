#!/usr/bin/env python3
"""Resolve stadium names to Wikimedia Commons images via Wikidata.

Usage:
  python3 fetch_stadium_images.py stadiums.json > stadium_images.json

Prints progress to stderr. Does not invent URLs.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.parse

import requests

UA = "TheReflectiveFootball/1.0 (stadium image research; https://thereflectivefootball.com)"
WD_API = "https://www.wikidata.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
SLEEP = 0.35

# Official / sponsor names that Wikidata often lists under the older label.
ALIASES = {
    "Spotify Camp Nou": ["Camp Nou", "Spotify Camp Nou"],
    "Riyadh Air Metropolitano": [
        "Metropolitano Stadium",
        "Cívitas Metropolitano",
        "Wanda Metropolitano",
        "Riyadh Air Metropolitano",
    ],
    "Hill Dickinson Stadium": [
        "Everton Stadium",
        "Bramley-Moore Dock Stadium",
        "Hill Dickinson Stadium",
    ],
    "Johan Cruijff ArenA": ["Johan Cruyff Arena", "Amsterdam Arena", "Johan Cruijff ArenA"],
    "Orange Vélodrome": ["Stade Vélodrome", "Orange Vélodrome"],
    "Diego Armando Maradona": ["Stadio Diego Armando Maradona", "Stadio San Paolo"],
    "Kingdom Arena": ["Kingdom Arena", "King Fahd International Stadium"],
}


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
        params={"action": "wbgetentities", "ids": qid, "format": "json"},
        timeout=30,
    )
    r.raise_for_status()
    return (r.json().get("entities") or {}).get(qid) or {}


def claim_values(ent: dict, pid: str) -> list:
    out = []
    for c in (ent.get("claims") or {}).get(pid, []):
        mainsnak = c.get("mainsnak") or {}
        dv = mainsnak.get("datavalue") or {}
        val = dv.get("value")
        if val is not None:
            out.append(val)
    return out


def commons_info(s: requests.Session, filename: str) -> dict | None:
    title = filename if filename.startswith("File:") else f"File:{filename}"
    r = s.get(
        COMMONS_API,
        params={
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size|mime",
            "format": "json",
        },
        timeout=30,
    )
    r.raise_for_status()
    pages = (r.json().get("query") or {}).get("pages") or {}
    page = next(iter(pages.values()), None)
    if not page or page.get("missing") is not None:
        return None
    infos = page.get("imageinfo") or []
    return infos[0] if infos else None


def pick_qid(hits: list[dict], stadium_name: str) -> tuple[str | None, str]:
    if not hits:
        return None, "not_found"
    name = stadium_name.lower()
    for h in hits:
        label = (h.get("label") or "").lower()
        desc = (h.get("description") or "").lower()
        if "stadium" in desc or "arena" in desc or "ground" in desc or "venue" in desc:
            return h.get("id"), "ok"
        if name[:12] in label or label in name:
            return h.get("id"), "review"
    return hits[0].get("id"), "review"


def resolve_one(s: requests.Session, club: dict) -> dict:
    slug = club["slug"]
    stadium = club["stadiumName"]
    city = club.get("city") or ""
    terms = list(ALIASES.get(stadium, [stadium]))
    if city:
        terms.append(f"{stadium} {city}")

    qid = None
    status = "not_found"
    last_err = None
    try:
        for term in terms:
            hits = search_wikidata(s, term)
            time.sleep(SLEEP)
            qid, status = pick_qid(hits, stadium)
            if qid:
                break
        if not qid:
            return {
                "slug": slug,
                "stadiumName": stadium,
                "status": "not_found",
            }
        ent = entity(s, qid)
        time.sleep(SLEEP)
        images = claim_values(ent, "P18")
        if not images:
            return {
                "slug": slug,
                "stadiumName": stadium,
                "wikidata": qid,
                "status": "not_found",
            }
        filename = images[0] if isinstance(images[0], str) else str(images[0])
        info = commons_info(s, filename)
        time.sleep(SLEEP)
        if not info:
            return {
                "slug": slug,
                "stadiumName": stadium,
                "wikidata": qid,
                "file": filename,
                "status": "error",
                "error": "commons_missing",
            }
        meta = info.get("extmetadata") or {}

        def meta_val(key: str) -> str:
            block = meta.get(key) or {}
            return (block.get("value") or "").strip()

        return {
            "slug": slug,
            "stadiumName": stadium,
            "wikidata": qid,
            "status": status if status == "ok" else "review",
            "imageUrl": info.get("url"),
            "thumbUrl": info.get("thumburl"),
            "license": meta_val("LicenseShortName") or meta_val("License"),
            "licenseUrl": meta_val("LicenseUrl"),
            "artist": meta_val("Artist"),
            "credit": meta_val("Credit"),
            "attributionRequired": meta_val("AttributionRequired") or "true",
            "file": filename,
        }
    except Exception as exc:  # noqa: BLE001
        last_err = str(exc)
        return {
            "slug": slug,
            "stadiumName": stadium,
            "status": "error",
            "error": last_err,
        }


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: fetch_stadium_images.py stadiums.json", file=sys.stderr)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        clubs = json.load(f)
    s = session()
    out = []
    for i, club in enumerate(clubs, 1):
        print(f"[{i}/{len(clubs)}] {club['slug']} — {club['stadiumName']}", file=sys.stderr)
        row = resolve_one(s, club)
        out.append(row)
        print(f"  → {row['status']}", file=sys.stderr)
    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
