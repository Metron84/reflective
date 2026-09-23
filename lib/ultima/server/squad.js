import {
  ULTIMA_LEAGUES,
  ULTIMA_SQUAD_SIZE,
  ULTIMA_XI_SIZE,
} from "@/lib/ultima/constants";
import { isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { filledXiCount } from "@/lib/ultima/lineup/slots";
import { expectedUltimaPoints } from "@/lib/ultima/projected-points";
import { scoreSlot } from "@/lib/ultima/scoring";
import { getCurrentGameweek, getGameweekByNumber } from "@/lib/ultima/server/bootstrap";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { getLineup, getManagerRoster, isLeagueLocked } from "@/lib/ultima/server/lineup";
import { safeResolve } from "@/lib/ultima/server/safe";
import { getStandings } from "@/lib/ultima/server/scoring-run";

function clubKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

function countdownTo(ms) {
  const left = ms - Date.now();
  if (!Number.isFinite(left) || left <= 0) return null;
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function nextLockAt(gameweek) {
  const opens = gameweek?.league_open_at;
  if (!opens || typeof opens !== "object") return null;
  const times = Object.values(opens)
    .map((value) => new Date(value).getTime())
    .filter((t) => Number.isFinite(t) && t > Date.now())
    .sort((a, b) => a - b);
  return times[0] ?? null;
}

async function pointsByPlayer(db, gameweekId, playerIds, thresholds, playersById) {
  const map = new Map();
  if (!db || !gameweekId || !playerIds.length) return map;

  const { data: fixtures } = await db
    .from("ultima_fixtures")
    .select("id")
    .eq("gameweek_id", gameweekId);
  const fixtureIds = (fixtures ?? []).map((row) => row.id);
  if (!fixtureIds.length) return map;

  const { data: stats } = await db
    .from("ultima_player_match_stats")
    .select("player_id, goals, assists, rating")
    .in("fixture_id", fixtureIds)
    .in("player_id", playerIds);

  const byPlayer = new Map();
  for (const row of stats ?? []) {
    if (!row.player_id) continue;
    const list = byPlayer.get(row.player_id) ?? [];
    list.push(row);
    byPlayer.set(row.player_id, list);
  }

  for (const id of playerIds) {
    const player = playersById.get(id);
    const rows = byPlayer.get(id);
    if (!rows?.length || !player) continue;
    const scored = scoreSlot(rows, {
      league: player.league,
      draftRound: player.draft_round,
      undraftedFa: !player.draft_round && player.bolt_eligible,
    }, thresholds);
    map.set(id, scored.total);
  }
  return map;
}

function nextFixtureForClub(fixtures, club) {
  const key = clubKey(club);
  if (!key) return null;
  const now = Date.now() - 3 * 60 * 60 * 1000;
  const match = (fixtures ?? []).find((row) => {
    const home = clubKey(row.home_club) === key;
    const away = clubKey(row.away_club) === key;
    if (!home && !away) return false;
    if (isLiveStatus(row.status)) return true;
    const t = new Date(row.kickoff_at ?? row.kickoff).getTime();
    return Number.isFinite(t) && t >= now;
  });
  if (!match) return null;
  const home = clubKey(match.home_club) === key;
  return {
    opponent: home ? match.away_club : match.home_club,
    venue: home ? "H" : "A",
    kickoff: match.kickoff_at ?? match.kickoff,
    live: isLiveStatus(match.status),
    homeScore: match.home_score,
    awayScore: match.away_score,
  };
}

export async function getSquadOffice({ competitionId, managerId }) {
  if (!competitionId || !managerId) return null;
  const db = getUltimaDb();
  const gameweek = await safeResolve(getCurrentGameweek(competitionId), null);
  const previous =
    gameweek?.number > 1
      ? await safeResolve(getGameweekByNumber(competitionId, gameweek.number - 1), null)
      : null;

  const [rosterRaw, lineup, seasonTable, lastTable, currentTable, competition] = await Promise.all([
    safeResolve(getManagerRoster(managerId), []),
    gameweek?.id
      ? safeResolve(getLineup(managerId, gameweek.id), [])
      : Promise.resolve([]),
    safeResolve(getStandings(competitionId), []),
    previous?.id
      ? safeResolve(getStandings(competitionId, previous.id), [])
      : Promise.resolve([]),
    gameweek?.id
      ? safeResolve(getStandings(competitionId, gameweek.id), [])
      : Promise.resolve([]),
    db
      ? safeResolve(
          db
            .from("ultima_competition")
            .select("rating_thresholds")
            .eq("id", competitionId)
            .maybeSingle()
            .then(({ data }) => data),
          null,
        )
      : Promise.resolve(null),
  ]);

  const roster = rosterRaw ?? [];
  const playerIds = roster.map((p) => p.id);
  const playersById = new Map(roster.map((p) => [p.id, p]));
  const thresholds = competition?.rating_thresholds ?? {};

  const horizonStart = new Date();
  horizonStart.setUTCDate(horizonStart.getUTCDate() - 1);
  const horizonEnd = new Date();
  horizonEnd.setUTCDate(horizonEnd.getUTCDate() + 10);

  const [lastPoints, livePoints, fixturesRaw] = await Promise.all([
    pointsByPlayer(db, previous?.id ?? gameweek?.id, playerIds, thresholds, playersById),
    gameweek?.id
      ? pointsByPlayer(db, gameweek.id, playerIds, thresholds, playersById)
      : Promise.resolve(new Map()),
    db
      ? safeResolve(
          db
            .from("ultima_fixtures")
            .select(
              "id, league, kickoff, kickoff_at, status, home_club, away_club, home_score, away_score",
            )
            .gte("kickoff", horizonStart.toISOString())
            .lte("kickoff", horizonEnd.toISOString())
            .order("kickoff", { ascending: true })
            .limit(80)
            .then(({ data }) => data ?? []),
          [],
        )
      : Promise.resolve([]),
  ]);

  const fixtures = (fixturesRaw ?? []).map((row) => ({
    ...row,
    status: normalizeFixtureStatus(row.status),
  }));

  const youSeason = (seasonTable ?? []).find((row) => row.id === managerId) ?? null;
  const youLast = (lastTable ?? []).find((row) => row.id === managerId) ?? null;
  const youNow = (currentTable ?? []).find((row) => row.id === managerId) ?? null;
  const lastGwPoints =
    youLast?.gameweekPoints != null
      ? youLast.gameweekPoints
      : youNow?.gameweekPoints != null
        ? youNow.gameweekPoints
        : null;

  const lockedLeagues = ULTIMA_LEAGUES.filter((league) =>
    gameweek ? isLeagueLocked(gameweek, league) : false,
  );
  const allLocked = ULTIMA_LEAGUES.every((league) => lockedLeagues.includes(league));
  const lockAt = nextLockAt(gameweek);
  const xvFilled = gameweek?.id ? filledXiCount(lineup) : 0;

  const players = roster.map((player) => ({
    id: player.id,
    name: player.name,
    club: player.club,
    league: player.league,
    position: player.position ?? player.seed_metrics?.position ?? null,
    bolt_eligible: Boolean(player.bolt_eligible),
    draft_round: player.draft_round ?? null,
    seed_metrics: player.seed_metrics ?? {},
    expectedPoints: expectedUltimaPoints(player),
    lastGwPoints: lastPoints.get(player.id) ?? null,
    livePoints: livePoints.get(player.id) ?? null,
    nextFixture: nextFixtureForClub(fixtures, player.club),
  }));

  return {
    players,
    lineup: lineup ?? [],
    gameweek: gameweek
      ? {
          id: gameweek.id,
          number: gameweek.number,
          state: gameweek.state,
          league_open_at: gameweek.league_open_at ?? null,
        }
      : null,
    lockedLeagues,
    allLocked,
    nextLockAt: lockAt ? new Date(lockAt).toISOString() : null,
    stats: [
      { label: "XV set", value: gameweek?.id ? `${xvFilled}/${ULTIMA_XI_SIZE}` : "-" },
      { label: "Last gameweek", value: lastGwPoints != null ? String(lastGwPoints) : "-" },
      { label: "Season points", value: youSeason ? String(youSeason.seasonPoints ?? 0) : "-" },
      { label: "Next lock", value: lockAt ? countdownTo(lockAt) ?? "-" : "-" },
    ],
    squadSize: players.length,
    squadCap: ULTIMA_SQUAD_SIZE,
  };
}
