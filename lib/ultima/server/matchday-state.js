/**
 * Server loader for per-league matchday state. Reads synced ultima_fixtures.
 */
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import {
  MATCHDAY_DONE,
  applyAllLeagueLockOverrides,
  applyLeagueLockOverride,
  computeAllLeagueMatchdayStates,
  computeLeagueMatchdayState,
  planLeagueSeed,
} from "@/lib/ultima/matchday-state";
import { getNextGameweek } from "@/lib/ultima/server/bootstrap";
import { getLoggedDb, getReadDb } from "@/lib/ultima/server/strict-db";

async function loadGameweekFixtures(gameweekId) {
  const db = getReadDb();
  if (!db || !gameweekId) return [];
  const { data, error } = await db
    .from("ultima_fixtures")
    .select("id, league, status, kickoff, kickoff_at")
    .eq("gameweek_id", gameweekId);
  if (error) {
    console.error("[ultima/matchday-state] fixtures", error.message);
    return [];
  }
  return data ?? [];
}

async function loadGameweekOverrides(gameweekId) {
  const db = getReadDb();
  if (!db || !gameweekId) return {};
  const { data } = await db
    .from("ultima_gameweeks")
    .select("league_lock_override")
    .eq("id", gameweekId)
    .maybeSingle();
  return data?.league_lock_override && typeof data.league_lock_override === "object"
    ? data.league_lock_override
    : {};
}

/**
 * Single authority: one league's matchday state for a gameweek.
 * @returns {Promise<'UPCOMING'|'LOCKED'|'LIVE'|'DONE'>}
 */
export async function getLeagueMatchdayState(competitionId, leagueId, gameweekId, now = Date.now()) {
  if (!competitionId || !leagueId || !gameweekId) return "UPCOMING";
  const [fixtures, overrides] = await Promise.all([
    loadGameweekFixtures(gameweekId),
    loadGameweekOverrides(gameweekId),
  ]);
  const computed = computeLeagueMatchdayState(
    fixtures.filter((f) => f.league === leagueId),
    now,
  );
  return applyLeagueLockOverride(computed, overrides[leagueId]);
}

/** All five leagues for one gameweek, with commissioner overrides applied. */
export async function getGameweekLeagueStates(competitionId, gameweekId, now = Date.now()) {
  if (!competitionId || !gameweekId) {
    return { states: computeAllLeagueMatchdayStates([], now), fixtures: [], overrides: {} };
  }
  const [fixtures, overrides] = await Promise.all([
    loadGameweekFixtures(gameweekId),
    loadGameweekOverrides(gameweekId),
  ]);
  const computed = computeAllLeagueMatchdayStates(fixtures, now);
  return {
    states: applyAllLeagueLockOverrides(computed, overrides),
    computed,
    fixtures,
    overrides,
  };
}

/**
 * Seed one league's slots from the current gameweek into the next, without
 * overwriting slots the manager already set on the next gameweek.
 */
export async function seedLeagueIntoNextGameweek({
  competitionId,
  currentGameweek,
  league,
  managerIds = null,
}) {
  const db = getLoggedDb("matchday-seed");
  if (!db || !competitionId || !currentGameweek?.id || !league) {
    return { ok: false, seeded: 0 };
  }
  const nextGw = await getNextGameweek(competitionId, currentGameweek.number);
  if (!nextGw?.id) return { ok: true, seeded: 0, skipped: "no_next" };

  let managers = managerIds;
  if (!managers?.length) {
    const { data } = await db
      .from("ultima_managers")
      .select("id")
      .eq("competition_id", competitionId);
    managers = (data ?? []).map((m) => m.id);
  }

  let seeded = 0;
  for (const managerId of managers) {
    const [{ data: current }, { data: next }] = await Promise.all([
      db
        .from("ultima_lineups")
        .select("slot, slot_group, player_id, is_captain, captain_off")
        .eq("manager_id", managerId)
        .eq("gameweek_id", currentGameweek.id)
        .eq("slot_group", league),
      db
        .from("ultima_lineups")
        .select("slot, slot_group, player_id, is_captain, captain_off")
        .eq("manager_id", managerId)
        .eq("gameweek_id", nextGw.id)
        .eq("slot_group", league),
    ]);
    const plan = planLeagueSeed({
      currentRows: current ?? [],
      nextRows: next ?? [],
      league,
    });
    for (const row of plan) {
      await db.from("ultima_lineups").upsert(
        {
          manager_id: managerId,
          gameweek_id: nextGw.id,
          slot: row.slot,
          slot_group: row.slot_group,
          player_id: row.player_id,
          locked_at: null,
          auto_started: false,
          is_captain: Boolean(row.is_captain),
          captain_off: Boolean(row.captain_off),
        },
        { onConflict: "manager_id,gameweek_id,slot" },
      );
      seeded += 1;
    }
  }
  return { ok: true, seeded, nextGameweekId: nextGw.id };
}

/**
 * For each league newly DONE (or unlocked→DONE after override clear), seed n+1.
 * @param {Record<string,string>} beforeStates
 * @param {Record<string,string>} afterStates
 */
export async function seedLeaguesNewlyDone({
  competitionId,
  gameweek,
  beforeStates,
  afterStates,
}) {
  const results = [];
  for (const league of ULTIMA_LEAGUES) {
    if (afterStates?.[league] !== MATCHDAY_DONE) continue;
    if (beforeStates?.[league] === MATCHDAY_DONE) continue;
    results.push(
      await seedLeagueIntoNextGameweek({
        competitionId,
        currentGameweek: gameweek,
        league,
      }),
    );
  }
  return results;
}
