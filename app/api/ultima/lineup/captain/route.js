import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { setCaptain } from "@/lib/ultima/server/lineup";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";

export const runtime = "nodejs";

const STATUS = {
  NOT_IN_XV: 400,
  CAPTAIN_LOCKED: 409,
  NO_GAMEWEEK: 400,
  CAPTAIN_UNAVAILABLE: 503,
};

/** Make a player his country's captain. One tap, replaces the old captain. */
export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { manager, competition } = gate;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }
  const playerId = typeof body?.player_id === "string" ? body.player_id : "";
  if (!playerId) {
    return NextResponse.json({ code: "INVALID", message: "Pick a player." }, { status: 400 });
  }

  const gameweek = competition ? await getCurrentGameweek(competition.id) : null;
  if (!gameweek) {
    const { status, body: err } = ultimaErrorResponse("NO_GAMEWEEK", { status: STATUS.NO_GAMEWEEK });
    return NextResponse.json(err, { status });
  }

  const result = await setCaptain({
    managerId: manager.id,
    gameweekId: gameweek.id,
    gameweek,
    playerId,
  });
  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code, {
      status: STATUS[result.code] ?? 400,
    });
    return NextResponse.json(err, { status });
  }

  await recomputeGameweekScores(competition.id, gameweek.id);

  return NextResponse.json({ ok: true, captains: result.captains });
}
