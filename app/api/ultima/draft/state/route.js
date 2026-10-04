import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import {
  getActiveCompetition,
  getManagerForUser,
  getUltimaDb,
  isUltimaCommissioner,
} from "@/lib/ultima/server/db";
import { buildDraftRoomPayload, loadDraftContext } from "@/lib/ultima/server/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const manager = await getManagerForUser(user.id);
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(body, { status });
  }

  const ctx = await loadDraftContext(competition.id, { includeAvailable: false });
  if (!ctx) {
    return NextResponse.json({ state: "lobby", picks: [] });
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
      is_commissioner: await isUltimaCommissioner(user.id),
      scheduled_at: ctx.state.scheduled_at ?? null,
    },
  });

  return NextResponse.json(payload);
}
