import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { readActionKeyState } from "@/lib/ultima/server/action-keys";

export const runtime = "nodejs";

/**
 * Did my tap land? ?key=<Idempotency-Key>. Answers unknown (the server never saw
 * it, safe to retry), pending (still running) or done (with the stored result).
 */
export async function GET(request) {
  const gate = await requireSeatApi();
  if (!gate.ok) return gate.response;
  const key = new URL(request.url).searchParams.get("key");
  const state = await readActionKeyState({
    managerId: gate.manager?.id,
    competitionId: gate.competition?.id ?? gate.manager?.competition_id,
    key,
  });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
