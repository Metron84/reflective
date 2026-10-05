import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { setAutoDraft } from "@/lib/ultima/server/draft";

export const runtime = "nodejs";

export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { user, manager } = gate;
  if (!manager?.profile_complete) {
    const { status, body } = ultimaErrorResponse("PROFILE_INCOMPLETE");
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const result = await setAutoDraft(manager.id, Boolean(body?.enabled));
  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code ?? "UNAVAILABLE", {
      message: result.message,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json(result);
}
