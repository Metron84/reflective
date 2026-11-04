import { NextResponse } from "next/server";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { autoStartBotsForGameweek } from "@/lib/ultima/bots/lineup";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { isMatchdayLocked } from "@/lib/ultima/matchday-state";
import { getGameweekLeagueStates } from "@/lib/ultima/server/matchday-state";
import { runGameweekSync, getActiveGameweek, getGameweeksToSync } from "@/lib/ultima/server/sync";
import { runLineupReminders } from "@/lib/ultima/server/reminders";
import { withReadContext } from "@/lib/ultima/server/strict-db";

export const dynamic = "force-dynamic";

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competition = await getActiveCompetition();
  if (!competition) return NextResponse.json({ ok: true, skipped: true });

  const gameweek = await getActiveGameweek(competition.id);

  const locked = [];

  if (gameweek) {
    const { states } = await getGameweekLeagueStates(competition.id, gameweek.id);
    for (const league of ULTIMA_LEAGUES) {
      if (!isMatchdayLocked(states[league])) continue;
      locked.push(league);
      publishUltimaEvent("lineup.lock", { league, gameweek_id: gameweek.id, state: states[league] });
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

export async function GET(request) {
  return withReadContext("cron/ultima/lineup-lock", () => handle(request));
}
