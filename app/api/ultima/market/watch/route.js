import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getManagerForUser } from "@/lib/ultima/server/db";
import { setWatchlist } from "@/lib/ultima/server/watchlist";

export const runtime = "nodejs";

export async function POST(request) {
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
