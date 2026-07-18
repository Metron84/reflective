#!/usr/bin/env python3
"""
Phase 2: merge approved tm_selection_review.json into players_seed.json
with SAMPLE clue ladders. Emits stop report + SQL batches for new rows only.
"""
from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from unicodedata import category, normalize

ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = ROOT / "data" / "players_seed.json"
REVIEW_PATH = ROOT / "data" / "tm_selection_review.json"
REPORT_PATH = ROOT / "data" / "tm_merge_phase2_report.json"
SQL_DIR = ROOT / "supabase" / "seed" / "players_import"

LEAGUES = [
    "premier_league",
    "la_liga",
    "serie_a",
    "bundesliga",
    "ligue_1",
]

# Keys must be fold()-normalized (no punctuation).
NAT_MAP = {
    "korea south": "South Korea",
    "korea north": "North Korea",
    "czechia": "Czech Republic",
    "bosnia herzegovina": "Bosnia and Herzegovina",
    "north macedonia": "North Macedonia",
    "cote d ivoire": "Ivory Coast",
    "congo dr": "DR Congo",
    "dr congo": "DR Congo",
    "united states": "United States",
}

POS_WORD = {"GK": "goalkeeper", "DF": "defender", "MF": "midfielder", "FW": "forward"}


def fold(s: str) -> str:
    s = "".join(c for c in normalize("NFKD", (s or "").lower()) if category(c) != "Mn")
    for ch in ("-", "'", ".", ",", "/"):
        s = s.replace(ch, " ")
    return " ".join(s.split())


def tokens(s: str) -> frozenset[str]:
    return frozenset(fold(s).split())


def slugify(name: str) -> str:
    base = fold(name).replace(" ", "-")
    base = re.sub(r"[^a-z0-9-]", "", base)
    base = re.sub(r"-+", "-", base).strip("-")
    return base or "player"


def short_id(*parts: str) -> str:
    h = hashlib.sha256("|".join(parts).encode()).hexdigest()
    return h[:8]


def map_nationality(raw: str | None) -> str | None:
    if not raw:
        return None
    key = fold(raw)
    if key in NAT_MAP:
        return NAT_MAP[key]
    return raw.strip()


def clean_club(name: str) -> str:
    c = (name or "").strip()
    c = c.replace("Atlético de Madrid", "Atletico Madrid")
    c = c.replace("Atlético Madrid", "Atletico Madrid")
    c = c.replace("Internazionale", "Inter")
    c = c.replace("FC Internazionale Milano", "Inter")
    c = c.replace("Olympique Lyonnais", "Lyon")
    c = c.replace("Olympique Marseille", "Marseille")
    c = c.replace("Paris Saint-Germain FC", "Paris Saint-Germain")
    c = c.replace("Paris Saint-Germain", "Paris Saint-Germain")
    c = c.replace("Bayer 04 Leverkusen", "Bayer Leverkusen")
    c = c.replace("Borussia Mönchengladbach", "Borussia Monchengladbach")
    c = c.replace("1. FC ", "")
    c = c.replace("1.FKO ", "")
    if c.startswith("FC "):
        c = c[3:]
    if c.startswith("AC "):
        c = c[3:]
    if c.startswith("AS "):
        c = c[3:]
    if c.endswith(" FC"):
        c = c[:-3]
    if c.endswith(" CF"):
        c = c[:-3]
    return c.strip()


def map_position(raw: str | None) -> str | None:
    if not raw:
        return None
    r = raw.strip().upper()
    if r in POS_WORD:
        return r
    low = raw.strip().lower()
    if low in ("goalkeeper", "gk"):
        return "GK"
    if low in ("defender", "defence", "defense"):
        return "DF"
    if low in ("midfield", "midfielder"):
        return "MF"
    if low in ("attack", "attacker", "forward"):
        return "FW"
    return None


def initials(name: str) -> str:
    parts = [p for p in re.split(r"[\s\-]+", name) if p]
    return ".".join(p[0].upper() for p in parts) + "."


def sample_clues(row: dict) -> list[str]:
    nat = row["nationality"] or "football"
    pos = POS_WORD.get(row["position"] or "", "player")
    clubs = row["clubs"] or []
    club_path = ", ".join(clubs[:4]) if clubs else "the league"
    era_s = row["era_start"] if row["era_start"] is not None else "?"
    era_e = row["era_end"] if row["era_end"] is not None else "?"
    apps = row["appearances"]
    goals = row["goals"]
    assists = row["assists"]
    ga = row["goals_plus_assists"]
    init = initials(row["name"])
    surname = fold(row["name"]).split()[-1] if fold(row["name"]) else "x"
    # Unique per player by construction (facts differ).
    return [
        f"SAMPLE: A {era_s}-{era_e} league regular logged near the top of the appearances table.",
        f"SAMPLE: A {nat} {pos} in the {era_s}-{era_e} window.",
        f"SAMPLE: Club path in this league window: {club_path}.",
        f"SAMPLE: {apps} appearances, {goals} goals, {assists} assists ({ga} combined) in the logged window.",
        f"SAMPLE: Initials {init} Surname shape length {len(surname)}.",
    ]


def sql_str(value) -> str:
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def sql_text_array(arr) -> str:
    if not arr:
        return "array[]::text[]"
    return "array[" + ", ".join(sql_str(v) for v in arr) + "]"


def sql_int_array(arr) -> str:
    if not arr:
        return "array[]::integer[]"
    return "array[" + ", ".join(str(int(n)) for n in arr) + "]::integer[]"


def row_to_sql_values(p: dict) -> str:
    return f"""(
  {sql_str(p['id'])},
  {sql_str(p['person_id'])},
  {'true' if p['canonical'] else 'false'},
  {sql_str(p['name'])},
  {sql_str(p['category'])},
  {sql_str(p['league']) if p.get('league') is not None else 'null'},
  {sql_text_array(p.get('clubs') or [])},
  {sql_str(p.get('nationality'))},
  {sql_str(p.get('position'))},
  {int(p['birth_year']) if p.get('birth_year') is not None else 'null'},
  {int(p['shirt_number']) if p.get('shirt_number') is not None else 'null'},
  {int(p['era_start']) if p.get('era_start') is not None else 'null'},
  {int(p['era_end']) if p.get('era_end') is not None else 'null'},
  {sql_int_array(p.get('world_cup_editions') or [])},
  {sql_text_array(p.get('aliases') or [])},
  {sql_text_array(p.get('clues') or [])}
)"""


def nationality_compatible(a: str | None, b: str | None) -> bool:
    if not a or not b:
        return True
    fa, fb = fold(a), fold(b)
    fa = NAT_MAP.get(fa, fa)
    fb = NAT_MAP.get(fb, fb)
    return fa == fb or fa in fb or fb in fa


def main() -> None:
    seed_doc = json.loads(SEED_PATH.read_text())
    seed_players = seed_doc["players"]
    review_doc = json.loads(REVIEW_PATH.read_text())
    review_players = review_doc["players"]

    # Index existing persons
    by_person: dict[str, list[dict]] = defaultdict(list)
    for p in seed_players:
        by_person[p["person_id"]].append(p)

    person_meta = {}
    for pid, rows in by_person.items():
        can = next((r for r in rows if r.get("canonical")), rows[0])
        person_meta[pid] = {
            "name": can["name"],
            "norm": fold(can["name"]),
            "tok": tokens(can["name"]),
            "birth_year": can.get("birth_year"),
            "nationality": can.get("nationality"),
            "categories": {r["category"] for r in rows},
            "names": {fold(r["name"]) for r in rows},
            "toks": [tokens(r["name"]) for r in rows],
        }

    used_ids = {p["id"] for p in seed_players}
    used_person_ids = set(by_person.keys())

    inserted_by_league = Counter()
    skipped: list[dict] = []
    namesakes: list[dict] = []
    unplaced: list[dict] = []
    linked: list[dict] = []
    new_rows: list[dict] = []

    # Track new person_ids we create in this run
    new_person_by_norm: dict[str, dict] = {}

    for rev in review_players:
        league = rev["league"]
        name = rev["name"]
        if league not in LEAGUES:
            unplaced.append({"name": name, "league": league, "reason": "unknown_league"})
            continue

        missing = []
        if not name:
            missing.append("name")
        if rev.get("birth_year") is None:
            missing.append("birth_year")
        if not rev.get("nationality"):
            missing.append("nationality")
        if not map_position(rev.get("position")):
            missing.append("position")
        if not (rev.get("clubs") or []):
            missing.append("clubs")
        if rev.get("era_start") is None or rev.get("era_end") is None:
            missing.append("era")
        if rev.get("appearances") is None:
            missing.append("appearances")

        if missing:
            unplaced.append(
                {
                    "name": name,
                    "league": league,
                    "reason": "missing_fields",
                    "fields": missing,
                }
            )
            continue

        nfold = fold(name)
        ntok = tokens(name)
        byear = int(rev["birth_year"])
        nat = map_nationality(rev.get("nationality"))

        def exact_name_match(meta: dict) -> bool:
            return nfold in meta["names"] or any(rt == ntok for rt in meta["toks"])

        def fuzzy_same_person(meta: dict) -> bool:
            """Token equality or clear subset (Alisson / Alisson Becker, Son order flip)."""
            if exact_name_match(meta):
                return True
            return any(ntok <= rt or rt <= ntok for rt in meta["toks"])

        # Skip if already in this category (same human: fuzzy name + year + nat)
        skip_pid = None
        for pid, meta in person_meta.items():
            if league not in meta["categories"]:
                continue
            if not fuzzy_same_person(meta):
                continue
            if meta["birth_year"] == byear and nationality_compatible(
                nat, meta["nationality"]
            ):
                skip_pid = pid
                break

        if skip_pid:
            skipped.append(
                {
                    "name": name,
                    "league": league,
                    "existing_person_id": skip_pid,
                    "existing_name": person_meta[skip_pid]["name"],
                }
            )
            continue

        # Link to existing person in another category (same human only)
        link_pids = []
        for pid, meta in person_meta.items():
            if league in meta["categories"]:
                continue
            if meta["birth_year"] != byear:
                continue
            if not nationality_compatible(nat, meta["nationality"]):
                continue
            if fuzzy_same_person(meta):
                link_pids.append(pid)

        if len(link_pids) > 1:
            unplaced.append(
                {
                    "name": name,
                    "league": league,
                    "reason": "ambiguous_person_match",
                    "candidates": [
                        {
                            "person_id": pid,
                            "name": person_meta[pid]["name"],
                            "birth_year": person_meta[pid]["birth_year"],
                        }
                        for pid in link_pids
                    ],
                }
            )
            continue

        person_id = None
        canonical = True

        if len(link_pids) == 1:
            person_id = link_pids[0]
            canonical = False  # existing person already has a canonical row
            linked.append(
                {
                    "name": name,
                    "league": league,
                    "person_id": person_id,
                    "existing_name": person_meta[person_id]["name"],
                }
            )
        else:
            # New person — namesake guard: exact same display name, different human
            base = slugify(name)
            conflict_pids = []
            for pid, meta in person_meta.items():
                if not exact_name_match(meta) and pid != base:
                    continue
                if meta["birth_year"] == byear and nationality_compatible(
                    nat, meta["nationality"]
                ):
                    # Same human should have linked above; keep separate if we got here
                    continue
                conflict_pids.append(pid)

            prior = new_person_by_norm.get(nfold)
            if (
                prior
                and prior["birth_year"] == byear
                and nationality_compatible(nat, prior["nationality"])
            ):
                person_id = prior["person_id"]
                canonical = False
            elif conflict_pids:
                person_id = f"{base}-{byear}"
                while person_id in used_person_ids:
                    person_id = f"{person_id}-x"
                namesakes.append(
                    {
                        "name": name,
                        "league": league,
                        "person_id": person_id,
                        "conflicted_with": [
                            {
                                "person_id": pid,
                                "name": person_meta[pid]["name"],
                                "birth_year": person_meta[pid]["birth_year"],
                                "nationality": person_meta[pid]["nationality"],
                            }
                            for pid in sorted(set(conflict_pids))
                            if pid in person_meta
                        ],
                    }
                )
            else:
                person_id = base
                if person_id in used_person_ids:
                    person_id = f"{base}-{byear}"
                    namesakes.append(
                        {
                            "name": name,
                            "league": league,
                            "person_id": person_id,
                            "conflicted_with": [
                                {"person_id": base, "note": "slug already in use"}
                            ],
                        }
                    )

        clubs = []
        seen_c = set()
        for c in rev.get("clubs") or []:
            cc = clean_club(c)
            key = fold(cc)
            if cc and key not in seen_c:
                seen_c.add(key)
                clubs.append(cc)

        row = {
            "id": short_id(person_id, league, name, str(byear)),
            "name": name,
            "category": league,
            "league": league,
            "clubs": clubs,
            "nationality": nat,
            "position": map_position(rev.get("position")),
            "birth_year": byear,
            "shirt_number": None,
            "era_start": int(rev["era_start"]),
            "era_end": int(rev["era_end"]),
            "world_cup_editions": None,
            "aliases": [],
            "person_id": person_id,
            "canonical": canonical,
            "clues": [],
            # temp stats for clue writing
            "appearances": int(rev["appearances"]),
            "goals": int(rev.get("goals") or 0),
            "assists": int(rev.get("assists") or 0),
            "goals_plus_assists": int(rev.get("goals_plus_assists") or 0),
        }

        # Ensure unique row id
        while row["id"] in used_ids:
            row["id"] = short_id(row["id"], "x", str(len(used_ids)))

        row["clues"] = sample_clues(row)
        # Strip temp stats before seed write
        seed_row = {k: v for k, v in row.items() if k not in ("appearances", "goals", "assists", "goals_plus_assists")}

        # Validate clues
        assert len(seed_row["clues"]) == 5
        assert all(c.startswith("SAMPLE: ") for c in seed_row["clues"])
        assert all("—" not in c and "–" not in c for c in seed_row["clues"])

        new_rows.append(seed_row)
        used_ids.add(seed_row["id"])
        used_person_ids.add(person_id)
        inserted_by_league[league] += 1

        if person_id not in person_meta:
            person_meta[person_id] = {
                "name": name,
                "norm": nfold,
                "tok": ntok,
                "birth_year": byear,
                "nationality": nat,
                "categories": {league},
                "names": {nfold},
                "toks": [ntok],
            }
            new_person_by_norm[nfold] = {
                "person_id": person_id,
                "birth_year": byear,
                "nationality": nat,
            }
        else:
            person_meta[person_id]["categories"].add(league)
            person_meta[person_id]["names"].add(nfold)
            person_meta[person_id]["toks"].append(ntok)

    # Merge into seed
    seed_doc["players"] = seed_players + new_rows
    seed_doc["generated"] = "2026-07-18"
    seed_doc["version"] = (
        "person-model v2 + TM top300 SAMPLE merge "
        f"(+{len(new_rows)} rows; skipped {len(skipped)})"
    )
    seed_doc["note"] = (
        "person_id shared across a person's rows; exactly one canonical row per person. "
        "world_cup clues authored. New Transfermarkt top-300 league rows use SAMPLE "
        "ladders (Opening→Identity→Career→The Moment→The Giveaway) pending TRF voice. "
        "No em-dashes anywhere."
    )

    SEED_PATH.write_text(json.dumps(seed_doc, ensure_ascii=False, indent=1) + "\n")

    # SQL batches for NEW rows only (do not rewrite batches 01–06)
    BATCH = 80
    SQL_DIR.mkdir(parents=True, exist_ok=True)
    # Remove prior tm batches if re-run
    for old in SQL_DIR.glob("players_batch_tm_*.sql"):
        old.unlink()

    batch_files = []
    if new_rows:
        n_batches = (len(new_rows) + BATCH - 1) // BATCH
        for b in range(n_batches):
            slice_rows = new_rows[b * BATCH : (b + 1) * BATCH]
            num = b + 1
            filename = f"players_batch_tm_{num:02d}.sql"
            header = (
                f"-- TM SAMPLE merge batch {num}/{n_batches}: "
                f"{len(slice_rows)} new rows (of {len(new_rows)} new)\n"
                f"-- Paste into Supabase SQL Editor AFTER players_batch_01–06.\n"
                f"-- Run in order tm_01 → tm_{n_batches:02d}.\n"
            )
            head = """insert into public.players (
  id, person_id, canonical, name, category, league, clubs,
  nationality, position, birth_year, shirt_number, era_start, era_end,
  world_cup_editions, aliases, clues
) values
"""
            tail = """
on conflict (id) do update set
  person_id = excluded.person_id,
  canonical = excluded.canonical,
  name = excluded.name,
  category = excluded.category,
  league = excluded.league,
  clubs = excluded.clubs,
  nationality = excluded.nationality,
  position = excluded.position,
  birth_year = excluded.birth_year,
  shirt_number = excluded.shirt_number,
  era_start = excluded.era_start,
  era_end = excluded.era_end,
  world_cup_editions = excluded.world_cup_editions,
  aliases = excluded.aliases,
  clues = excluded.clues;
"""
            body = head + ",\n".join(row_to_sql_values(p) for p in slice_rows) + tail
            (SQL_DIR / filename).write_text(header + body + "\n")
            batch_files.append({"file": filename, "rows": len(slice_rows)})

    report = {
        "inserted_per_league": {lg: inserted_by_league.get(lg, 0) for lg in LEAGUES},
        "inserted_total": len(new_rows),
        "seed_row_count_after": len(seed_doc["players"]),
        "skipped_as_existing": skipped,
        "linked_to_existing_person": linked,
        "namesakes_disambiguated": namesakes,
        "unplaced": unplaced,
        "sql_batches": batch_files,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

    print(json.dumps({k: report[k] for k in (
        "inserted_per_league",
        "inserted_total",
        "seed_row_count_after",
        "skipped_as_existing",
        "linked_to_existing_person",
        "namesakes_disambiguated",
        "unplaced",
        "sql_batches",
    )}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
