import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { saveQueue } from "@/lib/ultima/server/queue";
import {
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
} from "@/lib/ultima/server/practice";

export const runtime = "nodejs";

export async function POST(request) {
  const gate = await requireUserApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { user } = gate;

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

  const result = await saveQueue(manager.id, body);
  return NextResponse.json(result.body, { status: result.status });
}
