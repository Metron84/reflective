import { NextResponse } from "next/server";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { runDraftReminders } from "@/lib/ultima/server/reminders";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competition = await getActiveCompetition();
  if (!competition) return NextResponse.json({ ok: true, skipped: true });

  const draft = await runDraftReminders(competition.id);
  return NextResponse.json({ ok: true, draft });
}
