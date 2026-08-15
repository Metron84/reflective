import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition, getManagerForUser } from "@/lib/ultima/server/db";
import { executePick } from "@/lib/ultima/server/draft";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const manager = await getManagerForUser(user.id);
  if (!manager?.profile_complete) {
    const { status, body } = ultimaErrorResponse("PROFILE_INCOMPLETE");
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const playerId = body?.player_id;
  if (!playerId) {
    return NextResponse.json({ code: "INVALID", message: "Pick a player." }, { status: 400 });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(err, { status });
  }

  const result = await executePick({
    competitionId: competition.id,
    managerId: manager.id,
    playerId,
  });

  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code, {
      message: result.message,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json({ ok: true, ...result });
}
