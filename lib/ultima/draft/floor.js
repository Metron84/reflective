import {
  ULTIMA_DRAFT_ROUNDS,
  ULTIMA_LEAGUES,
  ULTIMA_LEAGUE_SHORT,
  ULTIMA_SQUAD_FLOOR_PER_LEAGUE,
  ULTIMA_SQUAD_SIZE,
} from "@/lib/ultima/constants";

/**
 * Count roster picks per league for one manager.
 * @param {Array<{ league: string }>} picks
 */
export function countByLeague(picks) {
  const counts = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const p of picks) {
    if (counts[p.league] != null) counts[p.league] += 1;
  }
  return counts;
}

/**
 * Deficits for 3-per-league squad floor (v5).
 * @param {Record<string, number>} counts
 */
export function leagueDeficits(counts) {
  const deficits = {};
  for (const league of ULTIMA_LEAGUES) {
    deficits[league] = Math.max(
      0,
      ULTIMA_SQUAD_FLOOR_PER_LEAGUE - (counts[league] ?? 0),
    );
  }
  return deficits;
}

/**
 * Remaining draft slots for a manager (30 minus picks so far).
 */
export function remainingSlots(pickCount) {
  return Math.max(0, ULTIMA_SQUAD_SIZE - pickCount);
}

/**
 * Whether adding a player from `league` would violate the floor guard.
 * @param {Record<string, number>} counts current league counts
 * @param {string} league player league
 * @param {number} slotsLeft picks remaining for this manager
 * @param {Record<string, number>} [supply] draftable players left per league
 */
export function wouldBreakFloor(counts, league, slotsLeft, supply = {}) {
  const next = { ...counts, [league]: (counts[league] ?? 0) + 1 };
  const deficits = leagueDeficits(next);
  const totalDeficit = ULTIMA_LEAGUES.reduce(
    (sum, l) => sum + deficits[l],
    0,
  );
  if (totalDeficit > slotsLeft) return true;

  for (const l of ULTIMA_LEAGUES) {
    const cap = Math.min(slotsLeft, supply[l] ?? slotsLeft);
    if (deficits[l] > cap) return true;
  }
  return false;
}

/**
 * Forced leagues: deficit equals remaining slots.
 */
export function forcedLeagues(counts, slotsLeft) {
  const deficits = leagueDeficits(counts);
  return ULTIMA_LEAGUES.filter((l) => deficits[l] >= slotsLeft && slotsLeft > 0);
}

/**
 * Floor counter display state.
 */
export function floorCounterState(counts, slotsLeft) {
  const deficits = leagueDeficits(counts);
  const totalDeficit = ULTIMA_LEAGUES.reduce(
    (sum, l) => sum + deficits[l],
    0,
  );
  let mode = "open";
  if (totalDeficit >= slotsLeft && slotsLeft > 0) mode = "forced";
  else if (totalDeficit >= Math.max(0, slotsLeft - 2)) mode = "warning";
  return { counts, deficits, slotsLeft, mode, totalDeficit };
}

export function formatFloorCounter(counts, deficits, slotsLeft) {
  const parts = ULTIMA_LEAGUES.map((l) => {
    const label = ULTIMA_LEAGUE_SHORT[l] ?? l;
    const need = deficits[l];
    return need > 0 ? `${label} ${counts[l]} (need ${need})` : `${label} ${counts[l]}`;
  });
  return `${parts.join(" · ")} · ${slotsLeft} picks left`;
}

export { ULTIMA_DRAFT_ROUNDS };
