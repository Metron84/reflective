import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { markRead } from "@/lib/ultima/server/notifications";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mark one notification read ({ id }) or all of them ({ all: true }). */
export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;

  let body;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const all = body?.all === true;
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!all && !id) {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }
  const result = await markRead({ managerId: gate.manager.id, id, all });
  if (!result.ok) {
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "Could not update your inbox. Try again." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
