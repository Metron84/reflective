import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { getMatchday } from "@/lib/ultima/server/matchday";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Matchday data from stored scores. Live stats are written by the cron routes,
 * not by opening this page.
 */
export async function GET() {
  const gate = await requireSeatApi();
  if (!gate.ok) return gate.response;
  const { manager, competition } = gate;
  if (!competition) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 });

  const gameweek = await getCurrentGameweek(competition.id);
  const data = await getMatchday({
    competitionId: competition.id,
    managerId: manager.id,
    gameweek,
  });
  if (!data) return NextResponse.json({ code: "UNAVAILABLE" }, { status: 503 });

  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
