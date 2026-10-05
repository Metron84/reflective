import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getUndraftedPlayers } from "@/lib/ultima/server/players";
import { slimPoolPlayer } from "@/lib/ultima/server/draft";
import {
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
} from "@/lib/ultima/server/practice";

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

  const rows = await getUndraftedPlayers(room.competition_id);
  return NextResponse.json({ available: rows.map(slimPoolPlayer) });
}
