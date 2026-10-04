/**
 * Builds Ultima gameweek windows from a season's fixtures. Pure, no I/O.
 * Window rule fri_thu_gst: Friday 00:00 to Thursday 23:59:59 Dubai time (UTC+4,
 * no daylight saving), stored in UTC. Windows with no fixtures get no row and
 * no number, so international breaks are skipped.
 */
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";

const GST_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** UTC instant of 00:00 GST on the given YYYY-MM-DD. */
export function gstMidnightUtc(ymd) {
  return new Date(`${ymd}T00:00:00+04:00`);
}

/** ISO string with a +04:00 offset, the format league_open_at already uses. */
export function toGstIso(date) {
  const shifted = new Date(date.getTime() + GST_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+04:00`;
}

/**
 * @param {Array<{league: string, kickoff: string}>} fixtures
 * @param {{ firstFriday: string }} options  YYYY-MM-DD, must be a Friday in GST
 * @returns {{ gameweeks: object[], skipped: object[] }}
 */
export function buildGameweeks(fixtures, { firstFriday }) {
  const start0 = gstMidnightUtc(firstFriday);
  if (Number.isNaN(start0.getTime())) throw new Error(`Bad firstFriday: ${firstFriday}`);
  const weekday = new Date(start0.getTime() + GST_OFFSET_MS).getUTCDay();
  if (weekday !== 5) throw new Error(`${firstFriday} is not a Friday`);

  const buckets = new Map();
  for (const fx of fixtures) {
    const at = new Date(fx.kickoff);
    if (Number.isNaN(at.getTime()) || !ULTIMA_LEAGUES.includes(fx.league)) continue;
    const index = Math.floor((at.getTime() - start0.getTime()) / WEEK_MS);
    if (index < 0) continue;
    if (!buckets.has(index)) buckets.set(index, []);
    buckets.get(index).push({ league: fx.league, at });
  }
  if (!buckets.size) return { gameweeks: [], skipped: [] };

  const last = Math.max(...buckets.keys());
  const gameweeks = [];
  const skipped = [];
  let number = 0;

  for (let index = 0; index <= last; index += 1) {
    const windowStart = new Date(start0.getTime() + index * WEEK_MS);
    const windowEnd = new Date(windowStart.getTime() + WEEK_MS - 1000);
    const inWindow = buckets.get(index);

    if (!inWindow) {
      skipped.push({ windowStart, windowEnd });
      continue;
    }

    number += 1;
    const counts = {};
    const opens = {};
    for (const { league, at } of inWindow) {
      counts[league] = (counts[league] ?? 0) + 1;
      if (!opens[league] || at < opens[league]) opens[league] = at;
    }
    const leagueOpenAt = {};
    for (const league of ULTIMA_LEAGUES) {
      if (opens[league]) leagueOpenAt[league] = toGstIso(opens[league]);
    }

    gameweeks.push({
      number,
      window_start: windowStart.toISOString(),
      window_end: windowEnd.toISOString(),
      league_open_at: leagueOpenAt,
      fixture_counts: counts,
      fixture_total: inWindow.length,
    });
  }

  return { gameweeks, skipped };
}
