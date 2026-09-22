import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_SIZE,
  ULTIMA_XI_FLOOR_PER_LEAGUE,
} from "@/lib/ultima/constants";
import { emptyLineupTemplate } from "@/lib/ultima/lineup/slots";

/** SAMPLE-only roster and XV. Not live players. Not for production scoring. */

function samplePlayer(league, index, extras = {}) {
  const n = index + 1;
  return {
    id: `sample-${league}-${n}`,
    name: `SAMPLE ${ULTIMA_LEAGUE_SHORT[league]} ${n}`,
    club: "SAMPLE Club",
    league,
    bolt_eligible: extras.bolt === true,
    last_gw_points: extras.last_gw ?? n,
    season_points: extras.season ?? n * 4,
    next_fixture: extras.fixture ?? "SAMPLE · Sat 18:30",
    points_per_game: extras.ppg ?? Number((0.2 + n * 0.08).toFixed(2)),
  };
}

export function sampleRoster() {
  const roster = [];
  for (const league of ULTIMA_LEAGUES) {
    const perLeague = ULTIMA_SQUAD_SIZE / ULTIMA_LEAGUES.length;
    for (let i = 0; i < perLeague; i += 1) {
      roster.push(
        samplePlayer(league, i, {
          bolt: league === "laliga" && i === 0,
          last_gw: 8 - i,
          season: 28 - i * 3,
          ppg: 0.7 - i * 0.08,
        }),
      );
    }
  }
  return roster;
}

function fillLineup(roster, skipLastLaliga) {
  const lineup = emptyLineupTemplate();
  const used = new Set();
  const filled = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const row of lineup) {
    if (
      skipLastLaliga &&
      row.slot_group === "laliga" &&
      filled.laliga >= ULTIMA_XI_FLOOR_PER_LEAGUE - 1
    ) {
      continue;
    }
    const next = roster.find(
      (p) => p.league === row.slot_group && !used.has(p.id),
    );
    if (!next) continue;
    row.player_id = next.id;
    used.add(next.id);
    filled[row.slot_group] += 1;
  }
  return lineup;
}

export function sampleXvState() {
  const roster = sampleRoster();
  return {
    roster,
    lineup: fillLineup(roster, true),
    lockedLeagues: [],
    gameweek: { state: "upcoming", number: 8 },
    liveTotal: null,
  };
}

export function sampleLiveState() {
  const roster = sampleRoster();
  return {
    roster,
    lineup: fillLineup(roster, false),
    lockedLeagues: ["pl", "laliga", "seriea"],
    gameweek: { state: "live", number: 8 },
    liveTotal: 41,
  };
}

export function sampleAllLockedState() {
  const roster = sampleRoster();
  return {
    roster,
    lineup: fillLineup(roster, false),
    lockedLeagues: [...ULTIMA_LEAGUES],
    gameweek: { state: "provisional", number: 8 },
    liveTotal: 67,
  };
}

export function sampleSquadTabState() {
  return {
    ...sampleXvState(),
  };
}
