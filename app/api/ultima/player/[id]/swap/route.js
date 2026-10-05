import { NextResponse } from "next/server";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getSwapList } from "@/lib/ultima/server/player-card";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";

export const runtime = "nodejs";

/** The "pick who goes" list. ?mode=add (free agent in) or drop (my player out). */
export async function GET(request, { params }) {
  const gate = await requireSeatApi();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const mode = new URL(request.url).searchParams.get("mode") === "drop" ? "drop" : "add";
  let list;
  try {
    list = await getSwapList({
      competition: gate.competition,
      manager: gate.manager,
      playerId: id,
      mode,
    });
  } catch (error) {
    console.error("[ultima/read] swap list", error?.message);
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503, message: "The list did not load. Try again." });
    return NextResponse.json(body, { status });
  }
  if (!list) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 404, message: "Player not found." });
    return NextResponse.json(body, { status });
  }
  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
}
