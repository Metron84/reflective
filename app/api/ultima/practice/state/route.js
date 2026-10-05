import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { buildDraftRoomPayload, loadDraftContext } from "@/lib/ultima/server/draft";
import {
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
} from "@/lib/ultima/server/practice";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const gate = await requireUserApi({ mutating: false });
  if (!gate.ok) return gate.response;
  const { user } = gate;

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

  const db = getLoggedDb("route:ultima/practice/state");
  const { data: queue, error: queueError } = await db
    .from("ultima_draft_queues")
    .select("player_id, position")
    .eq("manager_id", manager.id)
    .order("position");
  // A failed read must not look like an empty queue, or the client could save over it.
  if (queueError) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(body, { status });
  }

  const ctx = await loadDraftContext(room.competition_id, { includeAvailable: false });
  if (!ctx) {
    return NextResponse.json({ state: "lobby", picks: [], queue: queue ?? [], room: code });
  }

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
