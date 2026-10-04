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

/**
 * Fixture sync by gameweek window. Dry run by default: it fetches and counts, writes nothing.
 *   ?gameweeks=1,2,3   gameweek numbers (default: upcoming gameweeks starting within 14 days)
 *   ?apply=1           write the fixtures (tagged by window); only with this flag
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
  const apply = searchParams.get("apply") === "1";

  const competition = await getActiveCompetition();
  if (!competition) return NextResponse.json({ ok: true, skipped: true });
  const db = getUltimaDb();
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  try {
    const report = await runFixtureSync({ db, competitionId: competition.id, numbers, apply });
    return NextResponse.json({ ok: report.errors.length === 0, ...report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
