import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import {
  getActiveCompetition,
  isUltimaCommissioner,
} from "@/lib/ultima/server/db";
import { buildDraftRoomPayload, loadDraftContext } from "@/lib/ultima/server/draft";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSeatApi({ mutating: false });
  if (!gate.ok) return gate.response;
  const { user, manager } = gate;
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(body, { status });
  }

  const db = getLoggedDb("route:ultima/draft/state");
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

  const ctx = await loadDraftContext(competition.id, { includeAvailable: false });
  if (!ctx) {
    return NextResponse.json({ state: "lobby", picks: [], queue: queue ?? [] });
  }

  const payload = await buildDraftRoomPayload(ctx, {
    manager,
    queue: queue ?? [],
    extra: {
      is_commissioner: await isUltimaCommissioner(user.id),
      scheduled_at: ctx.state.scheduled_at ?? null,
    },
  });

  return NextResponse.json(payload);
}
