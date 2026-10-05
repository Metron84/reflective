import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { isFinishedStatus, isLiveStatus, normalizeFixtureStatus } from "@/lib/ultima/fixture-status";
import { getStatsProvider } from "@/lib/ultima/provider/index";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import {
  advanceGameweekState,
  syncStatsForFixtures,
  upsertFixturePacks,
} from "@/lib/ultima/server/sync";

/**
 * Live matchday refresh. The Vercel plan only allows daily crons, so the
 * matchday page asks for a refresh instead, and this module keeps it cheap:
 *
 * - at most one upstream refresh every LIVE_REFRESH_MS, whoever asks and from
 *   whichever server instance (the claim is a compare-and-swap on one row of
 *   ultima_europe_sync, so no migration is needed);
 * - nothing is fetched unless a fixture in the gameweek is on or just done;
 * - only fixtures already in the gameweek are updated, nothing new is created.
 */
export const LIVE_REFRESH_MS = 2 * 60 * 1000;
export const LIVE_ROW_ID = "matchday-live";

const BEFORE_KICKOFF_MS = 10 * 60 * 1000;
const AFTER_KICKOFF_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

let inflight = null;

/** Fixtures worth asking the provider about right now. Pure. */
export function liveCandidates(fixtures, now = Date.now()) {
  return (fixtures ?? []).filter((f) => {
    const status = normalizeFixtureStatus(f.status);
    if (status === "POSTP" || status === "CANC") return false;
    if (isLiveStatus(status)) return true;
    const t = new Date(f.kickoff_at ?? f.kickoff).getTime();
    if (!Number.isFinite(t)) return false;
    // Started (or about to) within the last five hours. Includes FT so the last
    // events and final ratings land, and NS rows whose status has not moved yet.
    return t - BEFORE_KICKOFF_MS <= now && now - t <= AFTER_KICKOFF_MS;
  });
}

/** True when the last refresh is recent enough to reuse. Pure. */
export function isFresh(lastOkAt, now = Date.now(), ttl = LIVE_REFRESH_MS) {
  if (!lastOkAt) return false;
  const t = new Date(lastOkAt).getTime();
  return Number.isFinite(t) && now - t < ttl;
}

/**
 * Take the refresh slot. True for exactly one caller per window across instances.
 * Compare-and-swap on the value we just read, so a second caller finds it changed.
 */
export async function claimRefresh(db, now = Date.now()) {
  const { data: row } = await db
    .from("ultima_europe_sync")
    .select("id, last_ok_at")
    .eq("id", LIVE_ROW_ID)
    .maybeSingle();

  if (isFresh(row?.last_ok_at, now)) return false;

  const stamp = new Date(now).toISOString();
  if (!row) {
    const { error } = await db
      .from("ultima_europe_sync")
      .insert({ id: LIVE_ROW_ID, last_ok_at: stamp, updated_at: stamp });
    // A concurrent insert fails on the primary key: someone else holds the slot.
    return !error;
  }

  let update = db
    .from("ultima_europe_sync")
    .update({ last_ok_at: stamp, updated_at: stamp })
    .eq("id", LIVE_ROW_ID);
  update = row.last_ok_at ? update.eq("last_ok_at", row.last_ok_at) : update.is("last_ok_at", null);
  const { data, error } = await update.select("id");
  return !error && (data ?? []).length > 0;
}

async function runRefresh({ competitionId, gameweek, now }) {
  const db = getUltimaDb();
  if (!db || !gameweek?.id) return { ok: false, skipped: "no_db" };

  const { data: rows } = await db
    .from("ultima_fixtures")
    .select("*")
    .eq("gameweek_id", gameweek.id);
  const candidates = liveCandidates(rows ?? [], now);
  if (!candidates.length) return { ok: true, skipped: "idle" };

  if (!(await claimRefresh(db, now))) return { ok: true, skipped: "fresh" };

  const provider = getStatsProvider();
  const errors = [];
  if (typeof provider.fetchFixtures === "function") {
    const wanted = new Set(candidates.map((f) => f.provider_id));
    const days = candidates.map((f) => new Date(f.kickoff_at ?? f.kickoff).getTime());
    const from = new Date(Math.min(...days) - DAY_MS).toISOString();
    const to = new Date(Math.max(...days) + DAY_MS).toISOString();
    const leagues = ULTIMA_LEAGUES.filter((l) => candidates.some((f) => f.league === l));

    const packs = await Promise.all(
      leagues.map(async (league) => {
        try {
          const fixtures = await provider.fetchFixtures(league, from, to);
          return { league, fixtures: fixtures.filter((f) => wanted.has(f.provider_id)), error: null };
        } catch (err) {
          return { league, fixtures: [], error: err?.message ?? "fetch failed" };
        }
      }),
    );
    const result = await upsertFixturePacks(db, packs, [gameweek]);
    errors.push(...result.errors);
  }

  // Re-read so stats follow the fresh statuses.
  const { data: fresh } = await db
    .from("ultima_fixtures")
    .select("*")
    .eq("gameweek_id", gameweek.id);
  const active = liveCandidates(fresh ?? [], now).filter(
    (f) => isLiveStatus(f.status) || isFinishedStatus(f.status),
  );
  const stats = await syncStatsForFixtures(active, { includeLive: true });
  if (!stats.ok) errors.push(stats.error ?? "stats failed");

  await recomputeGameweekScores(competitionId, gameweek.id);
  await advanceGameweekState(gameweek, competitionId);

  await db
    .from("ultima_europe_sync")
    .update({ last_error: errors[0] ?? null, last_fixture_count: candidates.length })
    .eq("id", LIVE_ROW_ID);

  return { ok: errors.length === 0, refreshed: candidates.length, errors };
}

/**
 * Refresh live scores and stats if due. Safe to call on every page hit: calls in
 * the same instance share one run, and across instances the claim limits it to
 * one per window. Never throws.
 */
export async function refreshMatchdayLive({ competitionId, gameweek, now = Date.now() }) {
  if (inflight) return inflight;
  inflight = runRefresh({ competitionId, gameweek, now })
    .catch((err) => {
      console.error("[ultima/live] refresh failed", err?.message ?? err);
      return { ok: false, error: err?.message ?? "refresh failed" };
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
