import { NextResponse } from "next/server";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { autoStartBotsForGameweek } from "@/lib/ultima/bots/lineup";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { runGameweekSync, getActiveGameweek, getGameweeksToSync } from "@/lib/ultima/server/sync";
import { runLineupReminders } from "@/lib/ultima/server/reminders";

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

  const gameweek = await getActiveGameweek(competition.id);

  const now = Date.now();
  const locked = [];

  if (gameweek) {
    for (const league of ULTIMA_LEAGUES) {
      const openAt = gameweek.league_open_at?.[league];
      if (!openAt) continue;
      if (now >= new Date(openAt).getTime()) {
        locked.push(league);
        publishUltimaEvent("lineup.lock", { league, gameweek_id: gameweek.id });
      }
    }

    if (locked.length) {
      await autoStartBotsForGameweek(competition.id, gameweek.id);
    }
  }

  // The current gameweek, plus any earlier one still live or provisional, so a
  // gameweek whose window just ended still gets its final scoring pass.
  const toSync = await getGameweeksToSync(competition.id);
  const syncs = [];
  for (const gw of toSync.length ? toSync : [gameweek]) {
    syncs.push({ gameweek: gw?.number ?? null, result: await runGameweekSync(competition.id, gw) });
  }

  const reminders = await runLineupReminders(competition.id);

  return NextResponse.json({
    ok: true,
    locked,
    gameweek: gameweek?.number ?? null,
    sync: syncs,
    reminders,
  });
}
