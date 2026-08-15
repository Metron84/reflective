import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { getStatsProvider } from "@/lib/ultima/provider/index";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { publishUltimaEvent } from "@/lib/ultima/server/events";

const FINISHED_STATUSES = new Set([
  "finished",
  "ft",
  "fulltime",
  "complete",
  "completed",
  "aet",
  "pen",
]);

function isFinishedStatus(status) {
  return FINISHED_STATUSES.has(String(status ?? "").toLowerCase());
}

function sportmonksIdFromProviderId(providerId) {
  const match = String(providerId ?? "").match(/^sm-fix-(\d+)$/);
  return match ? Number(match[1]) : null;
}

/**
 * Sync fixtures from the active provider into ultima_fixtures for a gameweek window.
 */
export async function syncFixturesForGameweek(gameweek) {
  const db = getUltimaDb();
  if (!db || !gameweek?.id) return { ok: false, error: "no_gw" };

  const provider = getStatsProvider();
  if (typeof provider.fetchFixtures !== "function") {
    return { ok: false, error: "no_fetch_fixtures" };
  }

  const from = gameweek.window_start;
  const to = gameweek.window_end;
  let synced = 0;

  for (const league of ULTIMA_LEAGUES) {
    const fixtures = await provider.fetchFixtures(league, from, to);
    for (const fix of fixtures) {
      const { error } = await db.from("ultima_fixtures").upsert(
        {
          provider_id: fix.provider_id,
          league: fix.league ?? league,
          kickoff: fix.kickoff,
          status: fix.status ?? "scheduled",
          gameweek_id: gameweek.id,
        },
        { onConflict: "provider_id" },
      );
      if (!error) synced += 1;
    }
  }

  return { ok: true, synced };
}

/**
 * Pull player match stats from Sportmonks (or mock) for fixtures in a gameweek.
 */
export async function syncStatsForGameweek(gameweekId) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const provider = getStatsProvider();
  const { data: fixtures } = await db
    .from("ultima_fixtures")
    .select("*")
    .eq("gameweek_id", gameweekId);

  const { data: players } = await db.from("ultima_players").select("id, provider_id, seed_metrics");
  const bySportmonksId = new Map();
  const byProvider = new Map();
  for (const p of players ?? []) {
    byProvider.set(`${p.provider_id}`, p.id);
    const smId = p.seed_metrics?.sportmonks_player_id;
    if (smId != null) bySportmonksId.set(Number(smId), p.id);
  }

  let statRows = 0;

  for (const fix of fixtures ?? []) {
    const smFixId = sportmonksIdFromProviderId(fix.provider_id);
    let stats = [];

    if (smFixId && typeof provider.fetchPlayerMatchStats === "function") {
      stats = await provider.fetchPlayerMatchStats(smFixId);
    } else if (typeof provider.getPlayerMatchStats === "function") {
      stats = provider.getPlayerMatchStats(fix.provider_id);
    }

    for (const row of stats) {
      const playerId =
        (row.sportmonks_player_id != null
          ? bySportmonksId.get(Number(row.sportmonks_player_id))
          : null) ??
        byProvider.get(row.provider_id) ??
        null;

      if (!playerId) continue;

      const { error } = await db.from("ultima_player_match_stats").upsert(
        {
          fixture_id: fix.id,
          player_id: playerId,
          goals: row.goals ?? 0,
          assists: row.assists ?? 0,
          rating: row.rating ?? null,
          raw_json: row.raw_json ?? {},
        },
        { onConflict: "fixture_id,player_id" },
      );
      if (!error) statRows += 1;
    }

    if (stats.length && isFinishedStatus(fix.status)) {
      await db
        .from("ultima_fixtures")
        .update({ status: "finished" })
        .eq("id", fix.id);
    }
  }

  return { ok: true, statRows };
}

/**
 * Advance gameweek state: upcoming → live → provisional → final.
 */
export async function advanceGameweekState(gameweek, competitionId) {
  const db = getUltimaDb();
  if (!db || !gameweek) return { ok: false };

  const now = Date.now();
  const windowStart = new Date(gameweek.window_start).getTime();
  const windowEnd = new Date(gameweek.window_end).getTime();

  let nextState = gameweek.state;

  if (gameweek.state === "upcoming" && now >= windowStart) {
    nextState = "live";
  }

  const { data: fixtures } = await db
    .from("ultima_fixtures")
    .select("status")
    .eq("gameweek_id", gameweek.id);

  const allFinished =
    (fixtures ?? []).length > 0 &&
    (fixtures ?? []).every((f) => isFinishedStatus(f.status));

  if (gameweek.state === "live" && allFinished) {
    nextState = "provisional";
  }

  if ((nextState === "provisional" || gameweek.state === "provisional") && now > windowEnd && allFinished) {
    nextState = "final";
  }

  if (nextState !== gameweek.state) {
    await db.from("ultima_gameweeks").update({ state: nextState }).eq("id", gameweek.id);
    publishUltimaEvent("gameweek.state", { gameweek_id: gameweek.id, state: nextState });

    if (nextState === "final") {
      await recomputeGameweekScores(competitionId, gameweek.id);
      publishUltimaEvent("gameweek.final", { gameweek_id: gameweek.id });
    }
  }

  return { ok: true, state: nextState };
}

/**
 * Full matchday sync: fixtures, stats, recompute scores, maybe finalize.
 */
export async function runGameweekSync(competitionId, gameweek) {
  if (!gameweek) return { ok: false, skipped: true };

  await syncFixturesForGameweek(gameweek);
  const stats = await syncStatsForGameweek(gameweek.id);
  await recomputeGameweekScores(competitionId, gameweek.id);
  const state = await advanceGameweekState(gameweek, competitionId);

  return { ok: true, stats, state };
}

/**
 * Create a gameweek row for live play (commissioner).
 */
export async function createGameweek({
  competitionId,
  number,
  windowStart,
  windowEnd,
  leagueOpenAt,
}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const { data, error } = await db
    .from("ultima_gameweeks")
    .insert({
      competition_id: competitionId,
      number,
      window_start: windowStart,
      window_end: windowEnd,
      league_open_at: leagueOpenAt,
      state: "upcoming",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, gameweekId: data.id };
}

export async function getActiveGameweek(competitionId) {
  const db = getUltimaDb();
  if (!db) return null;

  const { data } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("competition_id", competitionId)
    .in("state", ["upcoming", "live", "provisional"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
