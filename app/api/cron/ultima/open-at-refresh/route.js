import { NextResponse } from "next/server";
import { getActiveCompetition, getUltimaDb } from "@/lib/ultima/server/db";
import { runOpenAtRefresh } from "@/lib/ultima/server/open-at-refresh";
import { withReadContext } from "@/lib/ultima/server/strict-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Daily 06:00 Dubai: pull fresh kickoffs into league_open_at for gameweeks starting within 14 days. */
async function handle(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.SPORTMONKS_API_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "SPORTMONKS_API_KEY is not set" }, { status: 500 });

  const competition = await getActiveCompetition();
  if (!competition) return NextResponse.json({ ok: true, skipped: true });

  const db = getUltimaDb();
  if (!db) return NextResponse.json({ ok: false, error: "Database not configured" }, { status: 500 });

  try {
    const report = await runOpenAtRefresh({
      db,
      key,
      competitionId: competition.id,
      apply: true,
    });
    return NextResponse.json({ ok: report.errors.length === 0, ...report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(request) {
  return withReadContext("cron/ultima/open-at-refresh", () => handle(request));
}
