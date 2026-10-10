import { NextResponse } from "next/server";
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import {
  CORRECTION_WINDOW_MS,
  fixtureNeedsLiveStats,
  LIVE_STATS_WINDOW_MS,
  MATCH_LENGTH_MS,
} from "@/lib/ultima/gameweek-state";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { syncStatsForFixtures } from "@/lib/ultima/server/sync";
import { getLoggedDb, withReadContext } from "@/lib/ultima/server/strict-db";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request) {
  const started = Date.now();
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const league = new URL(request.url).searchParams.get("league");
  if (!ULTIMA_LEAGUES.includes(league)) {
    return NextResponse.json({ ok: false, error: "Pick one league." }, { status: 400 });
  }

  const db = getLoggedDb("cron/ultima/live-stats");
  if (!db) return NextResponse.json({ ok: false, error: "no_db" }, { status: 500 });

  const since = new Date(Date.now() - (LIVE_STATS_WINDOW_MS + CORRECTION_WINDOW_MS + MATCH_LENGTH_MS)).toISOString();
  const { data, error } = await db
    .from("ultima_fixtures")
    .select("*, ultima_gameweeks(state)")
    .eq("league", league)
    .gte("kickoff_at", since);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message, elapsedMs: Date.now() - started }, { status: 500 });
  }

  const now = Date.now();
  const fixtures = (data ?? []).filter((row) =>
    fixtureNeedsLiveStats(row, row.ultima_gameweeks?.state ?? null, now),
  );
  const stats = fixtures.length
    ? await syncStatsForFixtures(fixtures, { includeLive: true })
    : { ok: true, statRows: 0, failed: 0 };

  return NextResponse.json({
    ok: stats.ok !== false,
    league,
    fixtures: fixtures.length,
    written: stats.statRows ?? 0,
    failed: stats.failed ?? 0,
    elapsedMs: Date.now() - started,
  });
}

export async function GET(request) {
  return withReadContext("cron/ultima/live-stats", () => handle(request));
}
