import {
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_SQUAD_SIZE,
} from "@/lib/ultima/constants";
import { xvSlotLocked } from "@/lib/ultima/lineup/lock";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getManagerCompetitionId, getUltimaDb } from "@/lib/ultima/server/db";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { buildTeamForm, clubKey } from "@/lib/ultima/server/form";
import {
  clearLineupSlots,
  getManagerRoster,
  isLeagueLocked,
  squadLeagueCounts,
} from "@/lib/ultima/server/lineup";
import { getFreeAgents } from "@/lib/ultima/server/players";
import { listPendingTradeTeams, voidTradesForPlayers } from "@/lib/ultima/server/trades";
import { notifyMarketMove, notifyVoidedTrades } from "@/lib/ultima/server/notifications";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { takenLine } from "@/lib/ultima/receipts";
import { floorMessage, floorShortfall } from "@/lib/ultima/trades/rules";
import { getWatchlistIds } from "@/lib/ultima/server/watchlist";

/** True when the player holds a starting-XV slot that is locked this gameweek. */
async function lockedInXv({ managerId, player, gameweek }) {
  const db = getUltimaDb();
  if (!db || !gameweek?.id || !player || !xvSlotLocked(gameweek, player.league)) return false;
  const { data } = await db
    .from("ultima_lineups")
    .select("slot")
    .eq("manager_id", managerId)
    .eq("gameweek_id", gameweek.id)
    .eq("player_id", player.id)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Plain line for a refused signing. The database decides; this only words it. */
function signRefusal(result) {
  switch (result?.code) {
    case "PICK_TAKEN":
      return {
        ok: false,
        code: "PICK_TAKEN",
        message: takenLine({ takenBy: result.taken_by, takenAt: result.taken_at }),
      };
    case "FLOOR_VIOLATION": {
      const tag = ULTIMA_LEAGUE_SHORT[result.league] ?? result.league;
      return {
        ok: false,
        code: "FLOOR_VIOLATION",
        message: `This leaves you with ${result.count} ${tag}. You need ${ULTIMA_SQUAD_FLOOR_PER_LEAGUE}.`,
      };
    }
    case "NOT_OWNED":
    case "IN_ACCEPTED_TRADE":
    case "XV_LOCKED":
    case "SQUAD_FULL":
      return { ok: false, code: result.code };
    default:
      return { ok: false, code: "UNAVAILABLE", message: "That player is not available." };
  }
}

/**
 * Sign a free agent and release a player in one database transaction. Squads
 * stay at 30. If two managers go for the same free agent, the roster unique
 * index decides: the first commit wins and the other is told who signed him.
 * A player signed after his country locks joins the bench.
 */
export async function addDropTransaction({
  managerId,
  addPlayerId,
  dropPlayerId,
  gameweekId,
}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };
  if (!managerId || !addPlayerId) return { ok: false, code: "UNAVAILABLE" };

  const { data, error } = await db.rpc("ultima_sign_player", {
    p_manager_id: managerId,
    p_add_player_id: addPlayerId,
    p_drop_player_id: dropPlayerId || null,
    p_gameweek_id: gameweekId || null,
    p_squad_size: ULTIMA_SQUAD_SIZE,
    p_floor: ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  });
  if (error || !data) {
    console.error("[ultima/market] sign failed", error?.message);
    return { ok: false, code: "UNAVAILABLE" };
  }
  if (!data.ok) return signRefusal(data);

  for (const row of data.voided ?? []) {
    publishUltimaEvent("trade.state", { trade_id: row.trade_id, state: "void" });
  }

  const [{ data: added }, { data: dropped }] = await Promise.all([
    db.from("ultima_players").select("*").eq("id", addPlayerId).maybeSingle(),
    dropPlayerId
      ? db.from("ultima_players").select("*").eq("id", dropPlayerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  publishUltimaEvent("market.transaction", {
    manager_id: managerId,
    added: added ?? null,
    dropped: dropped ?? null,
  });

  await notifyVoidedTrades(data.voided, "player_released");
  await notifyMarketMove({ managerId, added: added ?? null, dropped: dropped ?? null });

  return {
    ok: true,
    voided: (data.voided ?? []).length,
    added: added?.name ?? null,
    dropped: dropped?.name ?? null,
  };
}

export async function dropPlayer({ managerId, playerId, gameweekId, gameweek }) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const roster = await getManagerRoster(managerId);
  const dropPlayerRow = roster.find((p) => p.id === playerId);
  if (!dropPlayerRow) {
    return { ok: false, code: "FLOOR_VIOLATION", message: "That player is not on your squad." };
  }

  if (await lockedInXv({ managerId, player: dropPlayerRow, gameweek })) {
    return { ok: false, code: "XV_LOCKED" };
  }

  if (gameweek && isLeagueLocked(gameweek, dropPlayerRow.league)) {
    return { ok: false, code: "LEAGUE_LOCKED" };
  }

  const short = floorShortfall(roster, [playerId], []);
  if (short) {
    return { ok: false, code: "FLOOR_VIOLATION", message: floorMessage(short) };
  }

  await db.from("ultima_rosters").delete().eq("manager_id", managerId).eq("player_id", playerId);
  await clearLineupSlots(managerId, [playerId]);
  await voidTradesForPlayers(managerId, [playerId], "player_dropped");
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

  await notifyMarketMove({ managerId, dropped: dropPlayerRow });

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
    on_loan: Boolean(player.on_loan),
    parent_club: player.parent_club ?? null,
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

  const pendingTradeTeams = await listPendingTradeTeams(
    managerId,
    (roster ?? []).map((p) => p.id),
  );

  const draftComplete = draftRow?.state === "complete";
  // The market stays open through the gameweek. Locks are per country: a player
  // signed after his country locks joins the bench.
  const marketOpen = draftComplete;

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
    closedReason: !draftComplete ? "draft" : null,
    reopenAt: null,
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
      pendingTradeTeams: pendingTradeTeams.get(player.id) ?? [],
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
