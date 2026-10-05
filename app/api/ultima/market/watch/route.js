import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { setWatchlist } from "@/lib/ultima/server/watchlist";

export const runtime = "nodejs";

export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { user, manager } = gate;
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const result = await setWatchlist({
    managerId: manager.id,
    playerId: body?.player_id,
    on: Boolean(body?.on),
  });

  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code);
    return NextResponse.json(err, { status });
  }

  return NextResponse.json({ ok: true });
}
