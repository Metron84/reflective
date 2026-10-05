import { NextResponse } from "next/server";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getPlayerCard } from "@/lib/ultima/server/player-card";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";

export const runtime = "nodejs";

/** One player card, from the signed-in manager's side. */
export async function GET(_request, { params }) {
  const gate = await requireSeatApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  let card;
  try {
    card = await getPlayerCard({
      competition: gate.competition,
      manager: gate.manager,
      playerId: id,
    });
  } catch (error) {
    console.error("[ultima/read] player card", error?.message);
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503, message: "This player did not load. Try again." });
    return NextResponse.json(body, { status });
  }
  if (!card) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 404, message: "Player not found." });
    return NextResponse.json(body, { status });
  }
  return NextResponse.json(card, { headers: { "Cache-Control": "no-store" } });
}
