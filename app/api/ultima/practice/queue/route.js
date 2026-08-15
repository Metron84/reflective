import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getUltimaDb } from "@/lib/ultima/server/db";
import {
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
} from "@/lib/ultima/server/practice";

export const runtime = "nodejs";

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

  const playerIds = Array.isArray(body?.player_ids) ? body.player_ids : [];
  const db = getUltimaDb();
  await db.from("ultima_draft_queues").delete().eq("manager_id", manager.id);

  const rows = playerIds.map((playerId, i) => ({
    manager_id: manager.id,
    player_id: playerId,
    position: i + 1,
  }));

  if (rows.length) {
    await db.from("ultima_draft_queues").insert(rows);
  }

  return NextResponse.json({ ok: true });
}
