import { NextResponse } from "next/server";
import { getProviderName } from "@/lib/ultima/provider";
import { getActiveCompetition, getUltimaDb } from "@/lib/ultima/server/db";
import { syncPlayerPool } from "@/lib/ultima/server/players";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getProviderName();
  if (provider !== "sportmonks") {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_sportmonks", provider });
  }

  const competition = await getActiveCompetition();
  if (competition) {
    const db = getUltimaDb();
    const { data: state } = await db
      .from("ultima_draft_state")
      .select("state")
      .eq("competition_id", competition.id)
      .maybeSingle();

    if (state?.state === "live" || state?.state === "paused") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "draft_live",
        draftState: state.state,
      });
    }
  }

  const sync = await syncPlayerPool();
  return NextResponse.json({ ok: Boolean(sync?.ok), provider, sync });
}
