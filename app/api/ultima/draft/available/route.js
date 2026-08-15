import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition, getManagerForUser } from "@/lib/ultima/server/db";
import { slimPoolPlayer } from "@/lib/ultima/server/draft";
import { getUndraftedPlayers } from "@/lib/ultima/server/players";

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

  const rows = await getUndraftedPlayers(competition.id);
  return NextResponse.json({ available: rows.map(slimPoolPlayer) });
}
