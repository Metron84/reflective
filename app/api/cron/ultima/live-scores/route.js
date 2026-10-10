import { NextResponse } from "next/server";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { getLoggedDb, withReadContext } from "@/lib/ultima/server/strict-db";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function resolveGameweek(db, competitionId, raw) {
  if (!raw || raw === "current") return getCurrentGameweek(competitionId);
  if (/^[0-9a-f-]{36}$/i.test(raw)) {
    const { data } = await db.from("ultima_gameweeks").select("*").eq("id", raw).eq("competition_id", competitionId).maybeSingle();
    return data;
  }
  const number = Number(raw);
  if (!Number.isInteger(number) || number < 1) return null;
  const { data } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("number", number)
    .maybeSingle();
  return data;
}

async function handle(request) {
  const started = Date.now();
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    return NextResponse.json({ ok: true, skipped: true, fixtures: 0, written: 0, failed: 0, elapsedMs: Date.now() - started });
  }

  const db = getLoggedDb("cron/ultima/live-scores");
  if (!db) return NextResponse.json({ ok: false, error: "no_db" }, { status: 500 });

  const raw = new URL(request.url).searchParams.get("gameweek");
  const gameweek = await resolveGameweek(db, competition.id, raw);
  if (!gameweek?.id) {
    return NextResponse.json({ ok: false, error: "No gameweek." }, { status: 404 });
  }

  const scores = await recomputeGameweekScores(competition.id, gameweek.id);
  return NextResponse.json({
    ok: scores.ok !== false,
    gameweekId: gameweek.id,
    gameweek: gameweek.number,
    fixtures: 0,
    written: scores.managers ?? 0,
    failed: scores.ok === false ? 1 : 0,
    elapsedMs: Date.now() - started,
  });
}

export async function GET(request) {
  return withReadContext("cron/ultima/live-scores", () => handle(request));
}
