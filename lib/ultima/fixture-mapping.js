/**
 * Fixture to gameweek mapping by window. Pure, no I/O.
 * A fixture belongs to the gameweek whose [window_start, window_end] holds its kickoff.
 */
import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";

/** Kickoff as a UTC instant. Sportmonks sends "YYYY-MM-DD HH:MM:SS" in UTC with no zone. */
export function kickoffMs(value) {
  if (value == null) return NaN;
  const text = String(value).trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  return new Date(hasZone ? text : `${text.replace(" ", "T")}Z`).getTime();
}

export function gameweekForKickoff(kickoff, gameweeks) {
  const t = kickoffMs(kickoff);
  if (Number.isNaN(t)) return null;
  return (
    (gameweeks ?? []).find(
      (g) => g.window_start && g.window_end && new Date(g.window_start).getTime() <= t && t <= new Date(g.window_end).getTime(),
    ) ?? null
  );
}

/** { [gameweek number]: { pl, laliga, seriea, bundesliga, ligue1, total } } for the given gameweeks only. */
export function countByGameweek(fixtures, gameweeks) {
  const out = {};
  for (const g of gameweeks) out[g.number] = { ...Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0])), total: 0 };
  for (const fx of fixtures) {
    const gw = gameweekForKickoff(fx.kickoff_at ?? fx.kickoff, gameweeks);
    if (!gw || !ULTIMA_LEAGUES.includes(fx.league)) continue;
    out[gw.number][fx.league] += 1;
    out[gw.number].total += 1;
  }
  return out;
}
