import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition, getManagerForUser } from "@/lib/ultima/server/db";
import { ensureEuropeDesk, getEuropeDesk } from "@/lib/ultima/server/europe-board";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
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

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const desk = refresh
    ? await ensureEuropeDesk(competition.id)
    : await getEuropeDesk(competition.id);

  return NextResponse.json({ desk });
}
