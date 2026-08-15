import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { buildDraftRoomPayload, loadDraftContext } from "@/lib/ultima/server/draft";
import {
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
} from "@/lib/ultima/server/practice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const code = normalizeRoomCode(request.nextUrl.searchParams.get("code"));
  const room = await getPracticeRoom(code);
  if (!room) {
    const { status, body } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(body, { status });
  }

  const manager = await getPracticeManager(user.id, room.competition_id);
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  const ctx = await loadDraftContext(room.competition_id, { includeAvailable: false });
  if (!ctx) {
    return NextResponse.json({ state: "lobby", picks: [], room: code });
  }

  const db = getUltimaDb();
  const { data: queue } = await db
    .from("ultima_draft_queues")
    .select("player_id, position")
    .eq("manager_id", manager.id)
    .order("position");

  const payload = await buildDraftRoomPayload(ctx, {
    manager,
    queue: queue ?? [],
    extra: {
      room: code,
      is_host: room.host_user_id === user.id,
      keep: Boolean(room.keep),
    },
  });

  return NextResponse.json(payload);
}
