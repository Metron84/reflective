#!/usr/bin/env python3
"""Second pass: alias searches for missing clubs; drop training grounds and known mismatches."""

from __future__ import annotations

import json
import sys
import time

from fetch_stadium_names import (
    SLEEP,
    entity,
    preferred_claim_ids,
    resolve_club,
    session,
    usable_name,
)

REJECT_NAME_BITS = (
    "ciudad deportiva",
    "ciutat esportiva",
    "training",
    "facilities",
    "youth",
    "academy",
)

REJECT_STADIUMS = {
    "Buffalo City Stadium",
    "Champion Hill",
    "Lohrheidestadion",
    "Griffin Park",
    "Poliesportiu d'Andorra",
    "Ciudad Deportiva Rayo Vallecano",
    "Estadi Son Bibiloni",
    "Zubieta Facilities",
    "Ciudad Deportiva del Real Valladolid",
}

SEARCH_ALIASES = {
    "1-fc-koln": "1. FC Köln",
    "1-fc-magdeburg": "1. FC Magdeburg",
    "1-fc-nurnberg": "1. FC Nürnberg",
    "albacete-bp": "Albacete Balompié",
    "arminia-bielefeld": "DSC Arminia Bielefeld",
    "aston-villa": "Aston Villa F.C.",
    "blackburn-rovers": "Blackburn Rovers F.C.",
    "bolton-wanderers": "Bolton Wanderers F.C.",
    "borussia-monchengladbach": "Borussia Mönchengladbach",
    "bradford-city": "Bradford City A.F.C.",
    "brentford": "Brentford F.C.",
    "brighton": "Brighton & Hove Albion F.C.",
    "burton-albion": "Burton Albion F.C.",
    "cadiz-cf": "Cádiz CF",
    "cambridge-united": "Cambridge United F.C.",
    "carrarese": "Carrarese Calcio",
    "cd-leganes": "CD Leganés",
    "cd-tenerife": "CD Tenerife",
    "ce-sabadell": "CE Sabadell FC",
    "derby-county": "Derby County F.C.",
    "doncaster-rovers": "Doncaster Rovers F.C.",
    "dynamo-dresden": "Dynamo Dresden",
    "eintracht-braunschweig": "Eintracht Braunschweig",
    "eintracht-frankfurt": "Eintracht Frankfurt",
    "energie-cottbus": "FC Energie Cottbus",
    "espanyol": "RCD Espanyol",
    "fc-andorra": "FC Andorra",
    "fc-augsburg": "FC Augsburg",
    "fc-metz": "FC Metz",
    "girona-fc": "Girona FC",
    "greuther-furth": "SpVgg Greuther Fürth",
    "hannover-96": "Hannover 96",
    "hertha-bsc": "Hertha BSC",
    "holstein-kiel": "Holstein Kiel",
    "huddersfield-town": "Huddersfield Town A.F.C.",
    "karlsruher-sc": "Karlsruher SC",
    "leeds-united": "Leeds United F.C.",
    "leicester-city": "Leicester City F.C.",
    "losc-lille": "Lille OSC",
    "luton-town": "Luton Town F.C.",
    "mainz-05": "1. FSV Mainz 05",
    "millwall": "Millwall F.C.",
    "milton-keynes-dons": "Milton Keynes Dons F.C.",
    "notts-county": "Notts County F.C.",
    "oxford-united": "Oxford United F.C.",
    "paris-fc": "Paris FC",
    "peterborough-united": "Peterborough United F.C.",
    "pisa": "Pisa SC",
    "plymouth-argyle": "Plymouth Argyle F.C.",
    "rayo-vallecano": "Rayo Vallecano",
    "rcd-mallorca": "RCD Mallorca",
    "real-oviedo": "Real Oviedo",
    "real-sociedad": "Real Sociedad",
    "real-sporting-gijon": "Sporting de Gijón",
    "real-valladolid": "Real Valladolid",
    "red-star-fc": "Red Star F.C.",
    "rodez-aveyron": "Rodez AF",
    "sampdoria": "U.C. Sampdoria",
    "sc-freiburg": "SC Freiburg",
    "sc-paderborn": "SC Paderborn 07",
    "sheffield-united": "Sheffield United F.C.",
    "sheffield-wednesday": "Sheffield Wednesday F.C.",
    "stade-brestois": "Stade Brestois 29",
    "stockport-county": "Stockport County F.C.",
    "stoke-city": "Stoke City F.C.",
    "swansea-city": "Swansea City A.F.C.",
    "ud-las-palmas": "UD Las Palmas",
    "udinese": "Udinese Calcio",
    "valencia": "Valencia CF",
    "vfl-bochum": "VfL Bochum",
    "vfl-osnabruck": "VfL Osnabrück",
    "vfl-wolfsburg": "VfL Wolfsburg",
    "virtus-entella": "Virtus Entella",
    "werder-bremen": "SV Werder Bremen",
    "west-bromwich-albion": "West Bromwich Albion F.C.",
    "west-ham-united": "West Ham United F.C.",
    "wigan-athletic": "Wigan Athletic F.C.",
    "wycombe-wanderers": "Wycombe Wanderers F.C.",
}


def is_rejected(row: dict) -> bool:
    name = (row.get("stadiumName") or "").strip()
    if name in REJECT_STADIUMS:
        return True
    low = name.lower()
    return any(bit in low for bit in REJECT_NAME_BITS)


def main() -> int:
    clubs = {c["slug"]: c for c in json.loads(open(sys.argv[1], encoding="utf-8").read())}
    current = json.loads(open(sys.argv[2], encoding="utf-8").read())
    kept = []
    retry_slugs = []
    for row in current:
        if is_rejected(row):
            retry_slugs.append(row["slug"])
            print(f"drop {row['slug']} ({row.get('stadiumName')})", file=sys.stderr)
        else:
            kept.append(row)

    have = {row["slug"] for row in kept}
    for slug in clubs:
        if slug not in have:
            retry_slugs.append(slug)
    retry_slugs = list(dict.fromkeys(retry_slugs))

    s = session()
    recovered = []
    still = []
    for i, slug in enumerate(retry_slugs, 1):
        club = dict(clubs[slug])
        alias = SEARCH_ALIASES.get(slug)
        if alias:
            club["name"] = alias
            club["common_name"] = alias
        print(f"[{i}/{len(retry_slugs)}] retry {slug} as {club.get('name')}", file=sys.stderr)
        resolved = resolve_club(s, club)
        if resolved and not is_rejected(resolved) and usable_name(resolved.get("stadiumName")):
            recovered.append(resolved)
            print(f"  → {resolved['stadiumName']}", file=sys.stderr)
        else:
            still.append(slug)
            print("  → not_found", file=sys.stderr)
        time.sleep(SLEEP)

    out = kept + recovered
    out.sort(key=lambda r: r["slug"])
    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
    print(file=sys.stdout)
    print(
        f"kept {len(kept)}; recovered {len(recovered)}; still missing {len(still)}",
        file=sys.stderr,
    )
    for slug in still:
        print(slug, file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
