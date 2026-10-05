import { NextResponse } from "next/server";
import { runNotifyCron } from "@/lib/ultima/server/notify-cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Every 15 minutes: expire offers, lock reminders, send held pushes. */
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runNotifyCron();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
