import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { requireCommissioner } from "@/lib/ultima/server/admin";
import { sendBroadcast } from "@/lib/ultima/server/broadcast";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const gate = await requireUserApi({ mutating: true });
  if (!gate.ok) return gate.response;

  if (!(await requireCommissioner(gate.user.id))) {
    const { status, body } = ultimaErrorResponse("NOT_COMMISSIONER", { status: 403 });
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(err, { status });
  }

  const result = await sendBroadcast({
    competitionId: competition.id,
    userId: gate.user.id,
    title: body?.title,
    body: body?.message,
    pinned: body?.pinned === true,
  });
  if (!result.ok) {
    const status = result.code === "INVALID" ? 400 : 503;
    const { body: err } = ultimaErrorResponse(result.code, { status, message: result.message });
    return NextResponse.json(err, { status });
  }
  return NextResponse.json({ ok: true, managers: result.managers, emailed: result.emailed });
}
