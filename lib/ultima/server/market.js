import {
  ULTIMA_LEAGUES,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_SQUAD_SIZE,
  leagueLabel,
} from "@/lib/ultima/constants";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getManagerCompetitionId, getUltimaDb } from "@/lib/ultima/server/db";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { buildTeamForm, clubKey } from "@/lib/ultima/server/form";
import { getManagerRoster, isLeagueLocked, squadLeagueCounts } from "@/lib/ultima/server/lineup";
import { getFreeAgents } from "@/lib/ultima/server/players";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { getWatchlistIds } from "@/lib/ultima/server/watchlist";

export async function addDropTransaction({
  managerId,
  addPlayerId,
  dropPlayerId,
  gameweekId,
  gameweek,
}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const roster = await getManagerRoster(managerId);
  if (roster.length >= ULTIMA_SQUAD_SIZE && !dropPlayerId) {
    return { ok: false, code: "SQUAD_FULL" };
  }

  const dropPlayer = roster.find((p) => p.id === dropPlayerId);
  if (dropPlayerId && !dropPlayer) {
    return { ok: false, code: "FLOOR_VIOLATION", message: "That player is not on your squad." };
  }

  if (dropPlayer && gameweek && isLeagueLocked(gameweek, dropPlayer.league)) {
    return { ok: false, code: "LEAGUE_LOCKED" };
  }

  const { data: addPlayer } = await db
    .from("ultima_players")
    .select("*")
    .eq("id", addPlayerId)
    .maybeSingle();

  if (!addPlayer) {
    return { ok: false, code: "UNAVAILABLE", message: "That player is not available." };
  }

  const competitionId = await getManagerCompetitionId(managerId);
  if (!competitionId) return { ok: false, code: "UNAVAILABLE" };

  const { data: onRoster } = await db
    .from("ultima_rosters")
    .select("manager_id")
    .eq("competition_id", competitionId)
    .eq("player_id", addPlayerId)
    .maybeSingle();

  if (onRoster) {
    return { ok: false, code: "PICK_TAKEN", message: "Someone else has him." };
  }

  // Simulate post-drop counts
  const counts = squadLeagueCounts(roster.filter((p) => p.id !== dropPlayerId));
  counts[addPlayer.league] = (counts[addPlayer.league] ?? 0) + 1;

  for (const league of ULTIMA_LEAGUES) {
    if (counts[league] < ULTIMA_SQUAD_FLOOR_PER_LEAGUE) {
      return {
        ok: false,
        code: "FLOOR_VIOLATION",
        message: `That move breaks the ${leagueLabel(league)} floor.`,
      };
    }
  }

  // Claim the addition before releasing the drop. If another manager takes him
  // in the same moment, the unique index rejects us and the squad is untouched.
  const { error: rosterErr } = await db.from("ultima_rosters").insert({
    competition_id: competitionId,
    manager_id: managerId,
    player_id: addPlayerId,
  });

  if (rosterErr) {
    return { ok: false, code: "PICK_TAKEN", message: "Someone else has him." };
  }

  if (dropPlayerId) {
    await db.from("ultima_rosters").delete().eq("manager_id", managerId).eq("player_id", dropPlayerId);
    await db.from("ultima_transactions").insert({
      manager_id: managerId,
      type: "drop",
      player_id: dropPlayerId,
      gameweek_id: gameweekId,
    });
  }

  await db
    .from("ultima_players")
    .update({
      draft_round: null,
      bolt_eligible: true,
    })
    .eq("id", addPlayerId);

  await db.from("ultima_transactions").insert({
    manager_id: managerId,
    type: "add",
    player_id: addPlayerId,
    related_player_id: dropPlayerId,
    gameweek_id: gameweekId,
  });

  await recordUltimaEvent({
    event: "market_add",
    managerId,
    payload: { add: addPlayerId, drop: dropPlayerId },
  });

  publishUltimaEvent("market.transaction", {
    manager_id: managerId,
    added: addPlayer,
    dropped: dropPlayer ?? null,
  });

  return { ok: true };
}

export async function dropPlayer({ managerId, playerId, gameweekId, gameweek }) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const roster = await getManagerRoster(managerId);
  const dropPlayerRow = roster.find((p) => p.id === playerId);
  if (!dropPlayerRow) {
    return { ok: false, code: "FLOOR_VIOLATION", message: "That player is not on your squad." };
  }

  if (gameweek && isLeagueLocked(gameweek, dropPlayerRow.league)) {
    return { ok: false, code: "LEAGUE_LOCKED" };
  }

  const counts = squadLeagueCounts(roster.filter((p) => p.id !== playerId));
  for (const league of ULTIMA_LEAGUES) {
    if (counts[league] < ULTIMA_SQUAD_FLOOR_PER_LEAGUE) {
      return { ok: false, code: "FLOOR_VIOLATION", message: "That drop breaks a league floor." };
    }
  }

  await db.from("ultima_rosters").delete().eq("manager_id", managerId).eq("player_id", playerId);
  await db.from("ultima_transactions").insert({
    manager_id: managerId,
    type: "drop",
    player_id: playerId,
    gameweek_id: gameweekId,
  });

  publishUltimaEvent("market.transaction", {
    manager_id: managerId,
    added: null,
    dropped: dropPlayerRow,
  });

  return { ok: true };
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

function nextLockLabel(gameweek) {
  const opens = gameweek?.league_open_at;
  if (!opens || typeof opens !== "object") return null;
  const times = Object.values(opens)
    .map((value) => new Date(value).getTime())
    .filter((t) => Number.isFinite(t) && t > Date.now())
    .sort((a, b) => a - b);
  if (!times.length) return null;
  return countdownTo(times[0]);
}

function slimPlayer(player) {
  if (!player) return null;
  return {
    id: player.id,
    name: player.name,
    club: player.club,
    league: player.league,
    position: player.position ?? null,
    bolt_eligible: Boolean(player.bolt_eligible),
    seed_metrics: player.seed_metrics ?? {},
  };
}

export async function getMarketOffice({ competitionId, managerId }) {
  const db = getUltimaDb();
  if (!db || !competitionId || !managerId) return null;

  const [draftRow, gameweek, roster, freeAgents, watchIds] = await Promise.all([
    db
      .from("ultima_draft_state")
      .select("state")
      .eq("competition_id", competitionId)
      .maybeSingle()
      .then(({ data }) => data),
    getCurrentGameweek(competitionId),
    getManagerRoster(managerId),
    getFreeAgents(competitionId),
    getWatchlistIds(managerId),
  ]);

  const draftComplete = draftRow?.state === "complete";
  const gwClosed = gameweek?.state === "live" || gameweek?.state === "provisional";
  const marketOpen = draftComplete && !gwClosed;

  const watchSet = new Set(watchIds);
  const faIds = new Set(freeAgents.map((p) => p.id));
  const missingWatch = watchIds.filter((id) => !faIds.has(id));

  let signedPlayers = [];
  if (missingWatch.length) {
    const [{ data: players }, { data: owned }] = await Promise.all([
      db.from("ultima_players").select("*").in("id", missingWatch),
      db
        .from("ultima_rosters")
        .select("player_id, ultima_managers(team_name)")
        .eq("competition_id", competitionId)
        .in("player_id", missingWatch),
    ]);
    const ownerById = new Map(
      (owned ?? []).map((row) => [row.player_id, row.ultima_managers?.team_name ?? "another club"]),
    );
    signedPlayers = (players ?? []).map((player) => ({
      ...slimPlayer(player),
      signedBy: ownerById.get(player.id) ?? "another club",
    }));
  }

  const faByClub = new Map();
  for (const player of freeAgents) {
    const key = `${player.league}:${clubKey(player.club)}`;
    faByClub.set(key, (faByClub.get(key) ?? 0) + 1);
  }

  const [{ data: standingsRows }, finishedPacks] = await Promise.all([
    db
      .from("ultima_standings")
      .select(
        "league, club_id, club_name, position, played, goals_for, goals_against, points",
      )
      .then(({ data }) => ({ data: data ?? [] })),
    Promise.all(
      ULTIMA_LEAGUES.map((league) =>
        db
          .from("ultima_fixtures")
          .select(
            "id, league, kickoff, kickoff_at, home_club, away_club, home_club_id, away_club_id, home_score, away_score",
          )
          .eq("status", "FT")
          .eq("league", league)
          .order("kickoff", { ascending: false })
          .limit(80)
          .then(({ data }) => data ?? []),
      ),
    ),
  ]);

  const finished = finishedPacks.flat();
  const clubs = (standingsRows ?? []).map((row) => ({
    club_id: row.club_id,
    name: row.club_name,
    club_name: row.club_name,
    league: row.league,
  }));
  const formByClub = new Map(
    buildTeamForm(finished, clubs).map((row) => [`${row.league}:${clubKey(row.club)}`, row.last5 ?? []]),
  );

  const tables = Object.fromEntries(ULTIMA_LEAGUES.map((league) => [league, []]));
  for (const row of standingsRows ?? []) {
    if (!tables[row.league]) continue;
    const gf = Number(row.goals_for);
    const ga = Number(row.goals_against);
    tables[row.league].push({
      clubId: row.club_id,
      club: row.club_name,
      position: row.position ?? null,
      played: row.played ?? null,
      gd: Number.isFinite(gf) && Number.isFinite(ga) ? gf - ga : null,
      points: row.points ?? null,
      form: formByClub.get(`${row.league}:${clubKey(row.club_name)}`) ?? [],
      faCount: faByClub.get(`${row.league}:${clubKey(row.club_name)}`) ?? 0,
    });
  }
  for (const league of ULTIMA_LEAGUES) {
    tables[league].sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  }

  const floors = squadLeagueCounts(roster);
  const formMissing = ULTIMA_LEAGUES.some((league) =>
    (tables[league] ?? []).some((row) => !row.form.length),
  );

  return {
    draftComplete,
    marketOpen,
    closedReason: !draftComplete ? "draft" : gwClosed ? "gameweek" : null,
    reopenAt: gwClosed ? gameweek?.window_end ?? null : null,
    nextLock: nextLockLabel(gameweek) ?? null,
    squadSize: roster.length,
    squadCap: ULTIMA_SQUAD_SIZE,
    floors,
    freeAgentCount: freeAgents.length,
    showFormNote: formMissing || !(standingsRows ?? []).length,
    floor: {
      deficits: Object.fromEntries(
        ULTIMA_LEAGUES.map((league) => [
          league,
          Math.max(0, ULTIMA_SQUAD_FLOOR_PER_LEAGUE - (floors[league] ?? 0)),
        ]),
      ),
    },
    roster: (roster ?? []).map((player) => ({
      ...slimPlayer(player),
      locked: Boolean(gameweek && isLeagueLocked(gameweek, player.league)),
    })),
    freeAgents: freeAgents.map((player) => slimPlayer(player)),
    watchlist: [
      ...freeAgents.filter((player) => watchSet.has(player.id)).map((player) => slimPlayer(player)),
      ...signedPlayers,
    ],
    watchedIds: watchIds,
    tables,
  };
}
