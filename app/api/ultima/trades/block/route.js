import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import {
  askAboutPlayer,
  resolveInterest,
  setBlockStance,
  setTradePrefs,
} from "@/lib/ultima/server/trade-block";

export const runtime = "nodejs";

function fail(result) {
  const status401 = result.code === "SIGN_IN_REQUIRED" ? 401 : undefined;
  const { status, body } = ultimaErrorResponse(result.code, {
    message: result.message,
    ...(status401 ? { status: status401 } : {}),
  });
  return NextResponse.json(body, { status });
}

/**
 * One endpoint for the trade block.
 * action: "stance" (list or open a player, or clear), "prefs" (looking for),
 * "ask" (interest in a player or a manager), "resolve" (seen, offered, dismissed).
 */
export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { manager } = gate;
  if (!manager || manager.is_bot) return fail({ code: "UNAVAILABLE" });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const competition = await getActiveCompetition();
  if (!competition) return fail({ code: "UNAVAILABLE" });

  let result;
  switch (body?.action) {
    case "stance":
      result = await setBlockStance({
        competitionId: competition.id,
        managerId: manager.id,
        playerId: body.player_id,
        stance: body.stance ?? null,
        note: body.note,
      });
      break;
    case "prefs":
      result = await setTradePrefs({
        managerId: manager.id,
        lookingFor: body.looking_for,
        note: body.note,
      });
      break;
    case "ask":
      result = await askAboutPlayer({
        competitionId: competition.id,
        fromId: manager.id,
        toId: body.to_manager_id,
        playerId: body.player_id ?? null,
        message: body.message,
      });
      break;
    case "resolve":
      result = await resolveInterest({
        managerId: manager.id,
        interestId: body.interest_id,
        state: body.state,
      });
      break;
    default:
      return NextResponse.json({ code: "INVALID", message: "Unknown action." }, { status: 400 });
  }

  if (!result.ok) return fail(result);
  return NextResponse.json(result);
}
