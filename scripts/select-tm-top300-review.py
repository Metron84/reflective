#!/usr/bin/env python3
"""
Phase 1: Select 300 Big 5 players for Guesser expansion review.

- Exclude anyone already in data/players_seed.json
- Rank per league by appearances, then goals+assists (from archive.zip)
- Take top 60 per league
- Emit data/tm_selection_review.json + .md only

Does NOT merge into the seed, generate clues, or write SQL.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import zipfile
from pathlib import Path
from unicodedata import category, normalize

LEAGUES = [
    "premier_league",
    "la_liga",
    "serie_a",
    "bundesliga",
    "ligue_1",
]

COMP_BY_LEAGUE = {
    "premier_league": "GB1",
    "la_liga": "ES1",
    "serie_a": "IT1",
    "bundesliga": "L1",
    "ligue_1": "FR1",
}

PER_LEAGUE = 60
SEASON_MIN = 2000
SEASON_MAX = 2025


def norm_name(s: str) -> str:
    s = "".join(
        c for c in normalize("NFKD", (s or "").lower()) if category(c) != "Mn"
    )
    for ch in ("-", "'", ".", ","):
        s = s.replace(ch, " ")
    return " ".join(s.split())


def load_seed_names(seed_path: Path) -> set[str]:
    data = json.loads(seed_path.read_text(encoding="utf-8"))
    return {norm_name(p["name"]) for p in data.get("players", [])}


def open_csv(zf: zipfile.ZipFile, name: str):
    return csv.DictReader(io.TextIOWrapper(zf.open(name), encoding="utf-8", newline=""))


def sum_goals_assists(
    zip_path: Path, player_ids: set[str]
) -> dict[str, dict[str, dict[str, int]]]:
    """
    Returns player_id -> competition_id -> {goals, assists, apps}
    for Big 5 games seasons 2000–2025.
    """
    comps = set(COMP_BY_LEAGUE.values())
    out: dict[str, dict[str, dict[str, int]]] = {}

    if not zip_path.is_file():
        print(f"WARNING: zip not found ({zip_path}); goals/assists = 0", file=sys.stderr)
        return out

    print(f"Summing goals/assists from {zip_path} …")
    with zipfile.ZipFile(zip_path) as zf:
        games: dict[str, str] = {}
        for row in open_csv(zf, "games.csv"):
            comp = row.get("competition_id") or ""
            if comp not in comps:
                continue
            try:
                season = int(row["season"])
            except (KeyError, ValueError, TypeError):
                continue
            if season < SEASON_MIN or season > SEASON_MAX:
                continue
            gid = row.get("game_id")
            if gid:
                games[gid] = comp

        for row in open_csv(zf, "appearances.csv"):
            pid = row.get("player_id")
            if not pid or pid not in player_ids:
                continue
            gid = row.get("game_id")
            comp = games.get(gid) if gid else None
            if not comp:
                continue
            bucket = out.setdefault(pid, {}).setdefault(
                comp, {"goals": 0, "assists": 0, "apps": 0}
            )
            try:
                bucket["goals"] += int(row.get("goals") or 0)
            except ValueError:
                pass
            try:
                bucket["assists"] += int(row.get("assists") or 0)
            except ValueError:
                pass
            bucket["apps"] += 1

    return out


def score_key(row: dict) -> tuple:
    # Higher is better
    return (
        row["appearances"],
        row["goals"] + row["assists"],
        row["goals"],
        row["name"].lower(),
    )


def md_escape(s: str) -> str:
    return (s or "").replace("|", "\\|").replace("\n", " ")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--extract-dir",
        type=Path,
        default=Path("data/transfermarkt_extract"),
    )
    parser.add_argument(
        "--seed",
        type=Path,
        default=Path("data/players_seed.json"),
    )
    parser.add_argument(
        "--zip",
        type=Path,
        default=Path.home() / "Downloads" / "archive.zip",
    )
    parser.add_argument(
        "--out-json",
        type=Path,
        default=Path("data/tm_selection_review.json"),
    )
    parser.add_argument(
        "--out-md",
        type=Path,
        default=Path("data/tm_selection_review.md"),
    )
    parser.add_argument("--per-league", type=int, default=PER_LEAGUE)
    args = parser.parse_args()

    if not args.seed.is_file():
        print(f"ERROR: seed not found: {args.seed}", file=sys.stderr)
        return 1
    if not args.extract_dir.is_dir():
        print(f"ERROR: extract dir not found: {args.extract_dir}", file=sys.stderr)
        return 1

    seed_names = load_seed_names(args.seed)
    print(f"Excluding {len(seed_names)} names already in seed")

    # Load candidates per league
    candidates: dict[str, list[dict]] = {}
    all_tm_ids: set[str] = set()
    excluded_counts = {}

    for league in LEAGUES:
        path = args.extract_dir / f"{league}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        kept = []
        excluded = 0
        for p in data["players"]:
            if norm_name(p["name"]) in seed_names:
                excluded += 1
                continue
            kept.append(p)
            all_tm_ids.add(str(p["transfermarkt_player_id"]))
        candidates[league] = kept
        excluded_counts[league] = excluded
        print(f"  {league}: {len(kept):,} candidates ({excluded} already in seed)")

    ga = sum_goals_assists(args.zip, all_tm_ids)

    selected_by_league: dict[str, list[dict]] = {}
    for league in LEAGUES:
        comp = COMP_BY_LEAGUE[league]
        ranked = []
        for p in candidates[league]:
            pid = str(p["transfermarkt_player_id"])
            stats = ga.get(pid, {}).get(comp, {})
            goals = int(stats.get("goals") or 0)
            assists = int(stats.get("assists") or 0)
            # Prefer extract appearances (authoritative for that league shortlist)
            apps = int(p.get("appearances") or 0)
            ranked.append(
                {
                    "transfermarkt_player_id": pid,
                    "name": p["name"],
                    "league": league,
                    "nationality": p.get("nationality"),
                    "position": p.get("position"),
                    "sub_position": p.get("sub_position"),
                    "birth_year": p.get("birth_year"),
                    "clubs": p.get("clubs") or [],
                    "era_start": p.get("season_first"),
                    "era_end": p.get("season_last"),
                    "appearances": apps,
                    "goals": goals,
                    "assists": assists,
                    "goals_plus_assists": goals + assists,
                    "player_code": p.get("player_code"),
                    "url": p.get("url"),
                }
            )
        ranked.sort(key=score_key, reverse=True)
        pick = ranked[: args.per_league]
        # Stable review rank 1..N within league
        for i, row in enumerate(pick, start=1):
            row["rank_in_league"] = i
        selected_by_league[league] = pick
        print(
            f"  selected {league}: {len(pick)} "
            f"(#{1} {pick[0]['name']} apps={pick[0]['appearances']} "
            f"g+a={pick[0]['goals_plus_assists']})"
        )

    flat = []
    for league in LEAGUES:
        flat.extend(selected_by_league[league])

    payload = {
        "phase": 1,
        "status": "awaiting_melo_approval",
        "note": (
            "Human gate: strike anyone who makes you say who? "
            "Refill from next-ranked in that league. "
            "Do not merge into players_seed until approved."
        ),
        "selection_rules": {
            "per_league": args.per_league,
            "total": len(flat),
            "rank_primary": "appearances",
            "rank_tiebreak": "goals + assists, then goals",
            "season_window": f"{SEASON_MIN}-{SEASON_MAX}",
            "excluded_seed_names": len(seed_names),
            "excluded_per_league": excluded_counts,
        },
        "leagues": {
            league: {
                "count": len(selected_by_league[league]),
                "players": selected_by_league[league],
            }
            for league in LEAGUES
        },
        "players": flat,
    }

    args.out_json.parent.mkdir(parents=True, exist_ok=True)
    args.out_json.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Markdown tables per league
    lines = [
        "# Transfermarkt top 300 — selection review (Phase 1)",
        "",
        f"**Status:** awaiting Melo approval. Total: **{len(flat)}** "
        f"({args.per_league} × 5 leagues).",
        "",
        "Ranked by appearances, then goals+assists. "
        "Strike anyone you don't recognise; refill from next-ranked.",
        "",
        "Do **not** merge into `players_seed.json` until this list is approved.",
        "",
    ]
    for league in LEAGUES:
        title = league.replace("_", " ").title()
        lines.append(f"## {title}")
        lines.append("")
        lines.append(
            "| # | Name | Nat | Pos | Born | Era | Apps | G | A | G+A | Clubs |"
        )
        lines.append(
            "|---|------|-----|-----|------|-----|------|---|---|-----|-------|"
        )
        for p in selected_by_league[league]:
            clubs = ", ".join(p["clubs"][:6])
            if len(p["clubs"]) > 6:
                clubs += ", …"
            era = f"{p['era_start'] or '—'}–{p['era_end'] or '—'}"
            lines.append(
                "| {rank} | {name} | {nat} | {pos} | {born} | {era} | {apps} | {g} | {a} | {ga} | {clubs} |".format(
                    rank=p["rank_in_league"],
                    name=md_escape(p["name"]),
                    nat=md_escape(p.get("nationality") or "—"),
                    pos=md_escape(p.get("position") or "—"),
                    born=p.get("birth_year") or "—",
                    era=era,
                    apps=p["appearances"],
                    g=p["goals"],
                    a=p["assists"],
                    ga=p["goals_plus_assists"],
                    clubs=md_escape(clubs),
                )
            )
        lines.append("")

    args.out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print()
    print(f"Wrote {args.out_json} ({len(flat)} players)")
    print(f"Wrote {args.out_md}")
    print("PAUSED — review the list before Phase 2.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
