import { NextResponse } from "next/server";
import { getActiveCompetition, getUltimaDb } from "@/lib/ultima/server/db";
import { autoStartBotsForGameweek } from "@/lib/ultima/bots/lineup";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competition = await getActiveCompetition();
  if (!competition) return NextResponse.json({ ok: true, skipped: true });

  const db = getUltimaDb();
  const { data: gameweek } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("competition_id", competition.id)
    .in("state", ["upcoming", "live", "provisional"])
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gameweek) return NextResponse.json({ ok: true, skipped: true });

  const now = Date.now();
  const locked = [];

  for (const league of ULTIMA_LEAGUES) {
    const openAt = gameweek.league_open_at?.[league];
    if (!openAt) continue;
    if (now >= new Date(openAt).getTime()) {
      locked.push(league);
      publishUltimaEvent("lineup.lock", { league, gameweek_id: gameweek.id });
    }
  }

  if (locked.length) {
    await autoStartBotsForGameweek(competition.id, gameweek.id);
    await recomputeGameweekScores(competition.id, gameweek.id);
  }

  return NextResponse.json({ ok: true, locked, gameweek: gameweek.number });
}
