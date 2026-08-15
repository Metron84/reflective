import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import {
  expirePracticeTurn,
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
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
    body = {};
  }

  const code = normalizeRoomCode(body?.code ?? request.nextUrl.searchParams.get("code"));
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

  const result = await expirePracticeTurn(code);
  return NextResponse.json({ ok: true, ...result });
}
