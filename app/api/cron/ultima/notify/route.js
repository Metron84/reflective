import { NextResponse } from "next/server";
import { runNotifyCron } from "@/lib/ultima/server/notify-cron";
import { withReadContext } from "@/lib/ultima/server/strict-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Every 15 minutes: expire offers, lock reminders, send held pushes. */
async function handle(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runNotifyCron();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request) {
  return withReadContext("cron/ultima/notify", () => handle(request));
}
