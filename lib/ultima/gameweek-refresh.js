/**
 * league_open_at refresh. Pure planning plus one small write helper.
 *
 * Changes only league_open_at, only on 'upcoming' gameweeks whose window starts
 * within the horizon. Never touches number, window_start, window_end or state.
 * A league whose league_open_at is already in the past (locked) is left alone.
 */
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { toGstIso } from "@/lib/ultima/gameweek-builder";

export const REFRESH_HORIZON_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Upcoming gameweeks that start within the horizon and have not ended. */
export function refreshCandidates(gameweeks, now, horizonDays = REFRESH_HORIZON_DAYS) {
  const limit = now.getTime() + horizonDays * DAY_MS;
  return gameweeks.filter(
    (gw) =>
      gw.state === "upcoming" &&
      new Date(gw.window_start).getTime() <= limit &&
      new Date(gw.window_end).getTime() > now.getTime(),
  );
}

/**
 * @param {{gameweeks: object[], fixtures: Array<{league:string,kickoff:string}>, now: Date, horizonDays?: number}} input
 * @returns {{ updates: Array<{id:string, number:number, league_open_at:object, changes:object[]}>, unchanged: number, skippedPast: object[], noFixtures: object[] }}
 */
export function planOpenAtRefresh({ gameweeks, fixtures, now, horizonDays = REFRESH_HORIZON_DAYS }) {
  const updates = [];
  const skippedPast = [];
  const noFixtures = [];
  let unchanged = 0;

  for (const gw of refreshCandidates(gameweeks, now, horizonDays)) {
    const start = new Date(gw.window_start).getTime();
    const end = new Date(gw.window_end).getTime();
    const firstKickoff = {};
    for (const fx of fixtures) {
      if (!ULTIMA_LEAGUES.includes(fx.league)) continue;
      const at = new Date(fx.kickoff);
      const t = at.getTime();
      if (Number.isNaN(t) || t < start || t > end) continue;
      if (!firstKickoff[fx.league] || t < firstKickoff[fx.league].getTime()) firstKickoff[fx.league] = at;
    }

    const current = gw.league_open_at ?? {};
    const next = { ...current };
    const changes = [];

    for (const league of ULTIMA_LEAGUES) {
      const old = current[league] ?? null;
      if (old && new Date(old).getTime() <= now.getTime()) {
        skippedPast.push({ number: gw.number, league, old });
        continue;
      }
      const found = firstKickoff[league];
      if (!found) {
        if (old) noFixtures.push({ number: gw.number, league, old });
        continue;
      }
      const fresh = toGstIso(found);
      if (old && new Date(old).getTime() === found.getTime()) {
        unchanged += 1;
        continue;
      }
      // A kickoff already past is the provider's live data, not a lock to reopen.
      if (found.getTime() <= now.getTime()) continue;
      next[league] = fresh;
      changes.push({ number: gw.number, league, old, new: fresh });
    }

    if (changes.length) updates.push({ id: gw.id, number: gw.number, league_open_at: next, changes });
  }

  return { updates, unchanged, skippedPast, noFixtures };
}

/** Writes league_open_at only, and only while the row is still 'upcoming'. */
export async function applyOpenAtRefresh(db, updates) {
  let applied = 0;
  const errors = [];
  for (const u of updates) {
    const { error } = await db
      .from("ultima_gameweeks")
      .update({ league_open_at: u.league_open_at })
      .eq("id", u.id)
      .eq("state", "upcoming");
    if (error) errors.push({ number: u.number, message: error.message });
    else applied += 1;
  }
  return { applied, errors };
}
