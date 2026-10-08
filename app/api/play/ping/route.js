import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap JSON ping so the first visit can clear the browser check before play. */
export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
