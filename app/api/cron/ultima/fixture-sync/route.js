import { NextResponse } from "next/server";
import { getActiveCompetition, getUltimaDb } from "@/lib/ultima/server/db";
import { runFixtureSync } from "@/lib/ultima/server/fixture-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

// League order: pl, laliga, seriea, bundesliga, ligue1. Approved 2026-10-04 for the 2026/27 launch.
const LAUNCH_EXPECTED = {
  1: { pl: 10, laliga: 10, seriea: 10, bundesliga: 9, ligue1: 9 },
  2: { pl: 10, laliga: 11, seriea: 10, bundesliga: 9, ligue1: 9 },
  3: { pl: 10, laliga: 10, seriea: 20, bundesliga: 9, ligue1: 9 },
};

/**
 * Fixture sync by gameweek window. Dry run by default: it fetches and counts, writes nothing.
 *   ?gameweeks=1,2,3   gameweek numbers (default: upcoming gameweeks starting within 14 days)
 *   ?scope=season      every gameweek not yet ended, to GW32; also sets league_open_at
 *                      from the first real kickoff per league (the daily cron in vercel.json)
 *   ?apply=1           write the fixtures (tagged by window); only with this flag
 *   ?guard=launch      with apply=1, write only if counts equal the approved launch counts;
 *                      on any mismatch nothing is written and the mismatches are returned
 */
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const numbers = (searchParams.get("gameweeks") ?? "")
    .split(",")
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n > 0);
  const scope = searchParams.get("scope") === "season" ? "season" : null;
  const apply = searchParams.get("apply") === "1";
  const expected = searchParams.get("guard") === "launch" ? LAUNCH_EXPECTED : null;

  const competition = await getActiveCompetition();
  if (!competition) return NextResponse.json({ ok: true, skipped: true });
  const db = getUltimaDb();
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  try {
    const report = await runFixtureSync({ db, competitionId: competition.id, numbers, scope, apply, expected });
    const ok = report.errors.length === 0 && !report.mismatches?.length;
    return NextResponse.json({ ok, ...report }, { status: ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
