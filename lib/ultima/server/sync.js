import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { leagueCodeForSlug, isFinishedStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getStatsProvider } from "@/lib/ultima/provider/index";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { publishUltimaEvent } from "@/lib/ultima/server/events";

function sportmonksIdFromProviderId(providerId) {
  const match = String(providerId ?? "").match(/^sm-fix-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function kickoffInWindow(kickoff, gameweek) {
  if (!gameweek?.id || !kickoff || !gameweek.window_start || !gameweek.window_end) return false;
  const at = new Date(kickoff).getTime();
  return at >= new Date(gameweek.window_start).getTime() && at <= new Date(gameweek.window_end).getTime();
}

function fixtureUpsertRow(fix, league, gameweek) {
  const status = normalizeFixtureStatus(fix.status);
  const kickoff = fix.kickoff_at ?? fix.kickoff;
  const scoresReady = fix.home_score != null && fix.away_score != null;
  const row = {
    provider_id: fix.provider_id,
    sportmonks_fixture_id: fix.sportmonks_fixture_id ?? sportmonksIdFromProviderId(fix.provider_id),
    league: fix.league ?? league,
    league_code: fix.league_code ?? leagueCodeForSlug(fix.league ?? league),
    kickoff,
    kickoff_at: kickoff,
    status,
    home_club: fix.home_club ?? null,
    away_club: fix.away_club ?? null,
    home_club_id: fix.home_club_id ?? null,
    away_club_id: fix.away_club_id ?? null,
    home_score: scoresReady ? Number(fix.home_score) : null,
    away_score: scoresReady ? Number(fix.away_score) : null,
    updated_at: new Date().toISOString(),
  };
  if (kickoffInWindow(kickoff, gameweek)) row.gameweek_id = gameweek.id;
  return row;
}

async function writeEuropeSync(db, patch) {
  await db.from("ultima_europe_sync").upsert(
    {
      id: "europe",
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: "id" },
  );
}

function unwrapStats(result) {
  if (Array.isArray(result)) {
    return {
      rows: result,
      ratingsAvailable: result.some((row) => row.rating != null),
    };
  }
  return {
    rows: result?.rows ?? [],
    ratingsAvailable: Boolean(result?.ratingsAvailable),
  };
}

/**
 * Sync fixtures from the active provider into ultima_fixtures for a window.
 */
export async function syncFixturesForWindow({ from, to, gameweek = null } = {}) {
  const db = getUltimaDb();
  if (!db || !from || !to) return { ok: false, error: "no_window", synced: 0 };

  const provider = getStatsProvider();
  if (typeof provider.fetchFixtures !== "function") {
    return { ok: false, error: "no_fetch_fixtures", synced: 0 };
  }

  let synced = 0;
  const errors = [];

  const fetched = await Promise.all(
    ULTIMA_LEAGUES.map(async (league) => {
      try {
        return { league, fixtures: await provider.fetchFixtures(league, from, to), error: null };
      } catch (err) {
        return { league, fixtures: [], error: err?.message ?? "fetch failed" };
      }
    }),
  );

  for (const pack of fetched) {
    if (pack.error) errors.push(`${pack.league}: ${pack.error}`);
    for (const fix of pack.fixtures) {
      const row = fixtureUpsertRow(fix, pack.league, gameweek);
      const { error } = await db.from("ultima_fixtures").upsert(row, { onConflict: "provider_id" });
      if (error) errors.push(`${pack.league}: ${error.message}`);
      else synced += 1;
    }
  }

  return {
    ok: errors.length === 0,
    synced,
    error: errors[0] ?? null,
    errors,
  };
}

export async function syncFixturesForGameweek(gameweek) {
  if (!gameweek?.id) return { ok: false, error: "no_gw", synced: 0 };
  return syncFixturesForWindow({
    from: gameweek.window_start,
    to: gameweek.window_end,
    gameweek,
  });
}

export async function syncStandings() {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const provider = getStatsProvider();
  if (typeof provider.fetchStandings !== "function") {
    return { ok: false, error: "no_standings", rows: 0 };
  }

  const asOf = isoDate(new Date());
  let rows = 0;
  const errors = [];

  const fetched = await Promise.all(
    ULTIMA_LEAGUES.map(async (league) => {
      try {
        return { league, ...(await provider.fetchStandings(league)), error: null };
      } catch (err) {
        return { league, rows: [], error: err?.message ?? "standings failed" };
      }
    }),
  );

  for (const pack of fetched) {
    if (pack.error) {
      errors.push(`${pack.league}: ${pack.error}`);
      continue;
    }
    const league = pack.league;
    for (const standing of pack.rows ?? []) {
        if (!standing.club_id || !Number.isFinite(standing.position)) continue;
        const payload = {
          league,
          league_code: standing.league_code ?? leagueCodeForSlug(league),
          season_id: standing.season_id,
          club_id: standing.club_id,
          club_name: standing.club_name,
          position: standing.position,
          played: standing.played ?? 0,
          won: standing.won ?? 0,
          drawn: standing.drawn ?? 0,
          lost: standing.lost ?? 0,
          goals_for: standing.goals_for ?? 0,
          goals_against: standing.goals_against ?? 0,
          points: standing.points ?? 0,
          previous_position: standing.previous_position,
          updated_at: new Date().toISOString(),
        };
        const { error } = await db
          .from("ultima_standings")
          .upsert(payload, { onConflict: "league,club_id" });
        if (error) errors.push(`${league}: ${error.message}`);
        else rows += 1;

        await db.from("ultima_standings_history").upsert(
          {
            as_of: asOf,
            league,
            club_id: standing.club_id,
            position: standing.position,
          },
          { onConflict: "as_of,league,club_id" },
        );
      }
  }

  return { ok: errors.length === 0, rows, error: errors[0] ?? null, errors };
}

async function playerLookupMaps(db) {
  const { data: players } = await db.from("ultima_players").select("id, provider_id, seed_metrics");
  const bySportmonksId = new Map();
  const byProvider = new Map();
  for (const p of players ?? []) {
    byProvider.set(`${p.provider_id}`, p.id);
    const smId = p.seed_metrics?.sportmonks_player_id;
    if (smId != null) bySportmonksId.set(Number(smId), p.id);
  }
  return { bySportmonksId, byProvider };
}

async function upsertStatRows(db, fix, stats, maps) {
  let statRows = 0;
  for (const row of stats) {
    const smPlayerId = row.sportmonks_player_id != null ? Number(row.sportmonks_player_id) : null;
    const playerId =
      (smPlayerId != null ? maps.bySportmonksId.get(smPlayerId) : null) ??
      maps.byProvider.get(row.provider_id) ??
      null;

    const payload = {
      fixture_id: fix.id,
      player_id: playerId,
      sportmonks_fixture_id: fix.sportmonks_fixture_id ?? sportmonksIdFromProviderId(fix.provider_id),
      sportmonks_player_id: smPlayerId,
      goals: row.goals ?? 0,
      assists: row.assists ?? 0,
      minutes: row.minutes ?? null,
      rating: row.rating ?? null,
      clean_sheet: Boolean(row.clean_sheet),
      yellow_cards: row.yellow_cards ?? 0,
      red_cards: row.red_cards ?? 0,
      raw_json: row.raw_json ?? {},
      updated_at: new Date().toISOString(),
    };

    const conflict = playerId
      ? "fixture_id,player_id"
      : "sportmonks_fixture_id,sportmonks_player_id";
    const { error } = await db.from("ultima_player_match_stats").upsert(payload, {
      onConflict: conflict,
    });
    if (!error) statRows += 1;
  }
  return statRows;
}

/**
 * Pull player match stats for finished fixtures.
 */
export async function syncStatsForFixtures(fixtures, { counts } = {}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db", statRows: 0, ratingsAvailable: false };

  const provider = getStatsProvider();
  const maps = await playerLookupMaps(db);
  let statRows = 0;
  let ratingsAvailable = false;
  const perLeague = counts ?? Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));

  for (const fix of fixtures ?? []) {
    if (!isFinishedStatus(fix.status)) continue;

    const smFixId = fix.sportmonks_fixture_id ?? sportmonksIdFromProviderId(fix.provider_id);
    let result = { rows: [], ratingsAvailable: false };

    if (smFixId && typeof provider.fetchPlayerMatchStats === "function") {
      try {
        result = unwrapStats(await provider.fetchPlayerMatchStats(smFixId));
      } catch (err) {
        console.error("ultima europe stats", fix.provider_id, err?.message ?? err);
        continue;
      }
    } else if (typeof provider.getPlayerMatchStats === "function") {
      result = unwrapStats(provider.getPlayerMatchStats(fix.provider_id));
    }

    if (result.ratingsAvailable) ratingsAvailable = true;
    const added = await upsertStatRows(db, fix, result.rows, maps);
    statRows += added;
    if (fix.league && fix.league in perLeague) perLeague[fix.league] += added;
  }

  return { ok: true, statRows, ratingsAvailable, perLeague };
}

export async function syncStatsForGameweek(gameweekId) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const { data: fixtures } = await db.from("ultima_fixtures").select("*").eq("gameweek_id", gameweekId);
  return syncStatsForFixtures(fixtures ?? []);
}

/**
 * Last five completed matchdays per league, once, then incremental FT only.
 */
export async function syncFinishedMatchStats({ backfill = false } = {}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  let query = db
    .from("ultima_fixtures")
    .select("*")
    .eq("status", "FT")
    .order("kickoff", { ascending: false });

  const { data: finished } = await query;
  const rows = finished ?? [];

  const selected = [];
  if (backfill) {
    const seenDates = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, new Set()]));
    for (const fix of rows) {
      const league = fix.league;
      if (!seenDates[league]) continue;
      const day = isoDate(fix.kickoff_at ?? fix.kickoff);
      if (seenDates[league].size >= 5 && !seenDates[league].has(day)) continue;
      seenDates[league].add(day);
      if (seenDates[league].size <= 5) selected.push(fix);
    }
  } else {
    selected.push(...rows.slice(0, 80));
  }

  const stats = await syncStatsForFixtures(selected);
  return { ...stats, fixtures: selected.length };
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

export async function runEuropeSync(competitionId, gameweek, { skipStats = false } = {}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const now = new Date();
  const from = addDays(now, -45).toISOString();
  const to = addDays(now, 10).toISOString();
  const windowFrom = gameweek?.window_start
    ? new Date(Math.min(new Date(from).getTime(), new Date(gameweek.window_start).getTime())).toISOString()
    : from;
  const windowTo = gameweek?.window_end
    ? new Date(Math.max(new Date(to).getTime(), new Date(gameweek.window_end).getTime())).toISOString()
    : to;

  try {
    const fixtures = await syncFixturesForWindow({
      from: windowFrom,
      to: windowTo,
      gameweek,
    });

    const standings = await syncStandings();

    const { data: syncRow } = await db
      .from("ultima_europe_sync")
      .select("stats_backfilled")
      .eq("id", "europe")
      .maybeSingle();

    const needBackfill = !skipStats && !syncRow?.stats_backfilled;
    const stats = skipStats
      ? { ok: true, ratingsAvailable: null, perLeague: {} }
      : await syncFinishedMatchStats({ backfill: needBackfill });

    if (gameweek?.id && !skipStats) {
      await recomputeGameweekScores(competitionId, gameweek.id);
      await advanceGameweekState(gameweek, competitionId);
    }

    const error = fixtures.error || standings.error || stats.error || null;
    if (error) console.error("ultima europe sync", error);

    await writeEuropeSync(db, {
      last_ok_at: fixtures.ok ? new Date().toISOString() : null,
      last_error: error,
      last_fixture_count: fixtures.synced ?? 0,
      ratings_available: stats.ratingsAvailable ?? false,
      stats_backfilled: Boolean(syncRow?.stats_backfilled) || needBackfill,
      last_stat_counts: stats.perLeague ?? {},
    });

    return { ok: !error, fixtures, standings, stats };
  } catch (err) {
    const message = err?.message ?? "europe sync failed";
    console.error("ultima europe sync", message);
    await writeEuropeSync(db, { last_error: message });
    return { ok: false, error: message };
  }
}

/**
 * Full matchday sync: fixtures, stats, recompute scores, maybe finalize.
 */
export async function runGameweekSync(competitionId, gameweek) {
  return runEuropeSync(competitionId, gameweek);
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
