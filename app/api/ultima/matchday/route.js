import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { refreshMatchdayLive } from "@/lib/ultima/server/live-refresh";
import { getMatchday } from "@/lib/ultima/server/matchday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Matchday data. Asking for it also refreshes live scores and stats from
 * Sportmonks, at most once every two minutes however many people ask.
 */
export async function GET() {
  const gate = await requireSeatApi();
  if (!gate.ok) return gate.response;
  const { manager, competition } = gate;
  if (!competition) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 });

  const gameweek = await getCurrentGameweek(competition.id);
  const refresh = gameweek
    ? await refreshMatchdayLive({ competitionId: competition.id, gameweek })
    : null;
  const data = await getMatchday({
    competitionId: competition.id,
    managerId: manager.id,
    gameweek,
  });
  if (!data) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 });

  return NextResponse.json(
    { ...data, refresh: refresh?.skipped ?? (refresh?.ok ? "refreshed" : "failed") },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
