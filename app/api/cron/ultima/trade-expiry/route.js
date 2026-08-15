import { NextResponse } from "next/server";
import { expireTradeReviews } from "@/lib/ultima/server/trades";
import { autoPickOnExpiry } from "@/lib/ultima/server/draft";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { getUltimaDb } from "@/lib/ultima/server/db";

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

  const trades = await expireTradeReviews();

  const competition = await getActiveCompetition();
  let draft = { ok: false };
  if (competition) {
    const db = getUltimaDb();
    const { data: state } = await db
      .from("ultima_draft_state")
      .select("*")
      .eq("competition_id", competition.id)
      .maybeSingle();

    if (
      state?.state === "live" &&
      state.turn_expires_at &&
      new Date(state.turn_expires_at).getTime() <= Date.now()
    ) {
      draft = await autoPickOnExpiry(competition.id);
    }
  }

  return NextResponse.json({ ok: true, trades, draft });
}
