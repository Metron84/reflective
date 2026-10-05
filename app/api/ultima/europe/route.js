import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { ensureEuropeDesk, getEuropeDesk } from "@/lib/ultima/server/europe-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
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

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const desk = refresh
    ? await ensureEuropeDesk(competition.id)
    : await getEuropeDesk(competition.id);

  return NextResponse.json({ desk });
}
