#!/usr/bin/env python3
"""
Extract Big 5 league players (2000–2026 seasons) from a Transfermarkt /
Kaggle player-scores archive.zip into local shortlists.

Does NOT import into Guesser / Supabase — research data only.

Usage:
  python3 scripts/extract-transfermarkt-big5.py \\
    --zip ~/Downloads/archive.zip \\
    --out data/transfermarkt_extract
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

# Transfermarkt competition_id → Guesser mode slug
LEAGUES = {
    "GB1": "premier_league",
    "ES1": "la_liga",
    "IT1": "serie_a",
    "L1": "bundesliga",
    "FR1": "ligue_1",
}

SEASON_MIN = 2000
SEASON_MAX = 2025  # 2025/26 campaign


def open_csv(zf: zipfile.ZipFile, name: str):
    return csv.DictReader(io.TextIOWrapper(zf.open(name), encoding="utf-8", newline=""))


def position_code(raw: str | None) -> str | None:
    if not raw:
        return None
    r = raw.strip().lower()
    if r in ("goalkeeper", "gk"):
        return "GK"
    if r in ("defender", "defence", "defense"):
        return "DF"
    if r in ("midfield", "midfielder"):
        return "MF"
    if r in ("attack", "attacker", "forward"):
        return "FW"
    return None


def birth_year(dob: str | None) -> int | None:
    if not dob:
        return None
    try:
        return int(dob[:4])
    except ValueError:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--zip",
        type=Path,
        default=Path.home() / "Downloads" / "archive.zip",
        help="Path to Transfermarkt/Kaggle archive.zip",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("data/transfermarkt_extract"),
        help="Output directory for shortlists",
    )
    parser.add_argument(
        "--min-appearances",
        type=int,
        default=1,
        help="Minimum appearances in a league to include (default: 1)",
    )
    args = parser.parse_args()

    if not args.zip.is_file():
        print(f"ERROR: zip not found: {args.zip}", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)

    print(f"Reading {args.zip} …")
    with zipfile.ZipFile(args.zip) as zf:
        names = set(zf.namelist())
        for required in ("games.csv", "appearances.csv", "players.csv", "clubs.csv"):
            if required not in names:
                print(f"ERROR: missing {required} in zip", file=sys.stderr)
                return 1

        # game_id → (competition_id, season)
        print("Pass 1/4: games (Big 5, seasons 2000–2025) …")
        games: dict[str, tuple[str, int]] = {}
        for row in open_csv(zf, "games.csv"):
            comp = row.get("competition_id") or ""
            if comp not in LEAGUES:
                continue
            try:
                season = int(row["season"])
            except (KeyError, ValueError, TypeError):
                continue
            if season < SEASON_MIN or season > SEASON_MAX:
                continue
            gid = row.get("game_id")
            if gid:
                games[gid] = (comp, season)
        print(f"  kept {len(games):,} Big 5 games")

        # player_id → league slug → stats
        print("Pass 2/4: appearances …")
        # player_id -> { league_slug: {seasons: set, clubs: set, apps: int, name: str} }
        by_player: dict[str, dict[str, dict]] = defaultdict(
            lambda: defaultdict(
                lambda: {"seasons": set(), "clubs": set(), "apps": 0, "name": None}
            )
        )
        apps_kept = 0
        for row in open_csv(zf, "appearances.csv"):
            gid = row.get("game_id")
            meta = games.get(gid) if gid else None
            if not meta:
                continue
            comp, season = meta
            league = LEAGUES[comp]
            pid = row.get("player_id")
            if not pid:
                continue
            bucket = by_player[pid][league]
            bucket["apps"] += 1
            bucket["seasons"].add(season)
            club_id = row.get("player_club_id")
            if club_id:
                bucket["clubs"].add(club_id)
            if row.get("player_name"):
                bucket["name"] = row["player_name"]
            apps_kept += 1
        print(f"  kept {apps_kept:,} appearances across {len(by_player):,} players")

        print("Pass 3/4: clubs …")
        club_names: dict[str, str] = {}
        for row in open_csv(zf, "clubs.csv"):
            cid = row.get("club_id")
            if cid:
                club_names[cid] = row.get("name") or row.get("club_code") or cid

        print("Pass 4/4: players …")
        player_meta: dict[str, dict] = {}
        for row in open_csv(zf, "players.csv"):
            pid = row.get("player_id")
            if pid not in by_player:
                continue
            player_meta[pid] = {
                "name": row.get("name") or "",
                "nationality": row.get("country_of_citizenship")
                or row.get("country_of_birth")
                or None,
                "position": position_code(row.get("position")),
                "sub_position": row.get("sub_position") or None,
                "birth_year": birth_year(row.get("date_of_birth")),
                "player_code": row.get("player_code") or None,
                "url": row.get("url") or None,
            }

    # Build per-league outputs
    summary = {
        "source": str(args.zip),
        "extracted_at": date.today().isoformat(),
        "season_min": SEASON_MIN,
        "season_max": SEASON_MAX,
        "min_appearances": args.min_appearances,
        "leagues": {},
        "note": "Research shortlist only. Not Guesser seed. Clues and person_id require Melo curation.",
    }

    for competition_id, league in LEAGUES.items():
        rows_out = []
        for pid, leagues in by_player.items():
            stats = leagues.get(league)
            if not stats or stats["apps"] < args.min_appearances:
                continue
            meta = player_meta.get(pid, {})
            name = meta.get("name") or stats.get("name") or f"player-{pid}"
            clubs = sorted(
                {club_names.get(c, c) for c in stats["clubs"] if c},
                key=str.lower,
            )
            seasons = sorted(stats["seasons"])
            rows_out.append(
                {
                    "transfermarkt_player_id": pid,
                    "name": name,
                    "category": league,
                    "league": league,
                    "nationality": meta.get("nationality"),
                    "position": meta.get("position"),
                    "sub_position": meta.get("sub_position"),
                    "birth_year": meta.get("birth_year"),
                    "clubs": clubs,
                    "seasons": seasons,
                    "season_first": seasons[0] if seasons else None,
                    "season_last": seasons[-1] if seasons else None,
                    "appearances": stats["apps"],
                    "player_code": meta.get("player_code"),
                    "url": meta.get("url"),
                }
            )

        rows_out.sort(key=lambda r: (-r["appearances"], r["name"].lower()))
        summary["leagues"][league] = {
            "competition_id": competition_id,
            "players": len(rows_out),
        }

        json_path = args.out / f"{league}.json"
        csv_path = args.out / f"{league}.csv"
        with json_path.open("w", encoding="utf-8") as f:
            json.dump(
                {
                    "league": league,
                    "competition_id": competition_id,
                    "season_min": SEASON_MIN,
                    "season_max": SEASON_MAX,
                    "count": len(rows_out),
                    "players": rows_out,
                },
                f,
                ensure_ascii=False,
                indent=2,
            )

        fieldnames = [
            "transfermarkt_player_id",
            "name",
            "nationality",
            "position",
            "sub_position",
            "birth_year",
            "clubs",
            "season_first",
            "season_last",
            "appearances",
            "url",
        ]
        with csv_path.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in rows_out:
                writer.writerow(
                    {
                        **r,
                        "clubs": "; ".join(r["clubs"]),
                    }
                )

        print(f"  {league}: {len(rows_out):,} players → {json_path.name}, {csv_path.name}")

    # Combined flat list (one row per player-league)
    combined = []
    for league in LEAGUES.values():
        path = args.out / f"{league}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        combined.extend(data["players"])
    combined.sort(key=lambda r: (r["category"], -r["appearances"], r["name"].lower()))

    combined_path = args.out / "all_big5.json"
    with combined_path.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "season_min": SEASON_MIN,
                "season_max": SEASON_MAX,
                "count": len(combined),
                "players": combined,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    unique_people = {r["transfermarkt_player_id"] for r in combined}
    summary["total_player_league_rows"] = len(combined)
    summary["unique_players"] = len(unique_people)

    summary_path = args.out / "summary.json"
    with summary_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    readme = args.out / "README.md"
    readme.write_text(
        "\n".join(
            [
                "# Transfermarkt Big 5 extract (research only)",
                "",
                "Players with at least one appearance in Premier League, La Liga,",
                "Serie A, Bundesliga, or Ligue 1 in seasons 2000–2025 (2000/01–2025/26).",
                "",
                "Source: Kaggle / transfermarkt-datasets `archive.zip`.",
                "",
                "**Not Guesser seed.** No clues, no person_id, no Supabase import.",
                "Use for shortlists and attribute enrichment; Melo curates what ships.",
                "",
                "Regenerate:",
                "",
                "```bash",
                "python3 scripts/extract-transfermarkt-big5.py \\",
                "  --zip ~/Downloads/archive.zip \\",
                "  --out data/transfermarkt_extract",
                "```",
                "",
                "Optional: `--min-appearances 10` to drop one-off cameos.",
                "",
            ]
        ),
        encoding="utf-8",
    )

    print()
    print(f"Done. Unique players: {len(unique_people):,}")
    print(f"Player–league rows: {len(combined):,}")
    print(f"Summary: {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
