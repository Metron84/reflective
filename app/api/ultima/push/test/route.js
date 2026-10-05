import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { sendTestPush } from "@/lib/ultima/server/notifications";
import { pushConfigured } from "@/lib/ultima/server/push";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;

  if (!pushConfigured()) {
    return NextResponse.json(
      { code: "PUSH_OFF", message: "Notifications are not set up yet." },
      { status: 503 },
    );
  }
  const result = await sendTestPush(gate.manager.id);
  if (result.ok) return NextResponse.json({ ok: true, sent: result.sent });
  if (result.code === "NO_SUBSCRIPTION") {
    return NextResponse.json(
      { code: result.code, message: "Turn on notifications on this device first." },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { code: "UNAVAILABLE", message: "The test did not send. Try again." },
    { status: 502 },
  );
}
