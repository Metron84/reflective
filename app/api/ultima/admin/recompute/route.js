import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { recomputeGameweekByNumber } from "@/lib/ultima/server/recompute-gameweek";
import { withReadContext } from "@/lib/ultima/server/strict-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.ULTIMA_CRON_SECRET;
  const sent = request.headers.get("x-cron-secret");
  if (!secret || !sent) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(sent);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = await withReadContext("ultima/admin/recompute", () =>
    recomputeGameweekByNumber(body?.gameweek),
  );
  if (!result.ok) {
    const status = result.code === "INVALID" ? 400 : result.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
