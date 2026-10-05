import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { removeSubscription, saveSubscription } from "@/lib/ultima/server/notifications";

export const runtime = "nodejs";

function invalid() {
  return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
}

/** Save this device's push subscription. Called after the manager taps "Turn on notifications". */
export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return invalid();
  }
  const result = await saveSubscription({
    managerId: gate.manager.id,
    subscription: body?.subscription,
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.ok) {
    if (result.code === "INVALID") return invalid();
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "Could not turn notifications on. Try again." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return invalid();
  }
  const result = await removeSubscription({
    managerId: gate.manager.id,
    endpoint: body?.endpoint,
  });
  return result.ok ? NextResponse.json({ ok: true }) : invalid();
}
