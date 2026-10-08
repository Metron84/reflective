import { NextResponse } from "next/server";
import { playRoute } from "@/lib/play/route-guard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cheap JSON ping so the first visit can clear the browser check before play. */
export function GET() {
  return playRoute("ping", () =>
    NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    ),
  );
}
