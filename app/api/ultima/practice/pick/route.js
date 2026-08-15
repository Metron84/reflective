import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { executePick } from "@/lib/ultima/server/draft";
import {
  expirePracticeTurn,
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
  PRACTICE_DRAFT_OPTS,
  practiceScope,
} from "@/lib/ultima/server/practice";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const code = normalizeRoomCode(body?.code);
  const room = await getPracticeRoom(code);
  if (!room) {
    const { status, body: err } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(err, { status });
  }

  const manager = await getPracticeManager(user.id, room.competition_id);
  if (!manager) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(err, { status });
  }

  const playerId = body?.player_id;
  if (!playerId) {
    return NextResponse.json({ code: "INVALID", message: "Pick a player." }, { status: 400 });
  }

  await expirePracticeTurn(code);

  const result = await executePick({
    competitionId: room.competition_id,
    managerId: manager.id,
    playerId,
    options: { ...PRACTICE_DRAFT_OPTS, eventScope: practiceScope(code) },
  });

  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code, {
      message: result.message,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json({ ok: true, ...result });
}
