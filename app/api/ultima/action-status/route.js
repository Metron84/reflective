import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { lookupActionKey, readActionKey } from "@/lib/ultima/server/action-keys";

export const runtime = "nodejs";

/**
 * Did my tap land? The browser asks this after waiting 10 seconds, instead of
 * showing an error. Returns { state: "done", status, body } with the stored
 * result, "working" while the first request still runs, or "unknown" when the
 * server never saw the key (then it is safe to send the same key again).
 */
export async function GET(request) {
  const gate = await requireSeatApi();
  if (!gate.ok) return gate.response;
  const { manager } = gate;

  const key = readActionKey({ headers: { get: () => new URL(request.url).searchParams.get("key") } });
  if (!key || !manager) {
    return NextResponse.json({ code: "INVALID", message: "Key required." }, { status: 400 });
  }

  const found = await lookupActionKey({ key, managerId: manager.id });
  const payload =
    found.state === "done"
      ? { state: "done", status: found.result.status, body: found.result.body }
      : { state: found.state };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
