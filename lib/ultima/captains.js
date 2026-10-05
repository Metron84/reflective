import { ULTIMA_LEAGUES } from "./constants.js";
import { xvSlotLocked } from "./lineup/lock.js";

/**
 * Captains. One per country, chosen from that country's 3 XV players, scores x2.
 * Pure rules shared by the server, the scoring run and the squad page.
 * A lineup row is { slot, slot_group, player_id, is_captain? }.
 */

/** Points multiplier for a captain's slot total. */
export const CAPTAIN_MULTIPLIER = 2;

/**
 * Who captains each country this week.
 * Explicit flag first (lowest slot wins if data ever holds two), else last
 * week's captain when he is still in this week's XV in the same country.
 * @param {Array<object>} lineup
 * @param {Record<string, string|null>|null} prevCaptains league -> player id, last gameweek
 * @returns {{ byLeague: Record<string, string|null>, carried: Record<string, boolean> }}
 */
export function resolveCaptains(lineup, prevCaptains = null) {
  const byLeague = {};
  const carried = {};
  for (const league of ULTIMA_LEAGUES) {
    const rows = (lineup ?? [])
      .filter((r) => r.slot_group === league && r.player_id)
      .sort((a, b) => a.slot - b.slot);
    const flagged = rows.find((r) => r.is_captain);
    if (flagged) {
      byLeague[league] = flagged.player_id;
      carried[league] = false;
      continue;
    }
    const prev = prevCaptains?.[league] ?? null;
    if (prev && rows.some((r) => r.player_id === prev)) {
      byLeague[league] = prev;
      carried[league] = true;
      continue;
    }
    byLeague[league] = null;
    carried[league] = false;
  }
  return { byLeague, carried };
}

/** Set of captain player ids from a resolved map. */
export function captainIdSet(byLeague) {
  return new Set(Object.values(byLeague ?? {}).filter(Boolean));
}

/**
 * After the XV changes, keep each country's captain only if he is still in the
 * XV in that country. Returns rows with exactly the surviving flags set.
 */
export function reconcileCaptains(before, after) {
  const prior = resolveCaptains(before).byLeague;
  const next = (after ?? []).map((r) => ({ ...r, is_captain: false }));
  for (const league of ULTIMA_LEAGUES) {
    const id = prior[league];
    if (!id) continue;
    const row = next.find((r) => r.slot_group === league && r.player_id === id);
    if (row) row.is_captain = true;
  }
  return next;
}

/**
 * Plan a captain change. One tap replaces the old captain in that country.
 * @returns {{ok:false, code:string} | {ok:true, noop:boolean, league:string, previousPlayerId:string|null, lineup:Array<object>}}
 */
export function planCaptainChange({ lineup, playerId, gameweek, now = Date.now() }) {
  if (!gameweek) return { ok: false, code: "NO_GAMEWEEK" };
  const row = (lineup ?? []).find((r) => r.player_id && r.player_id === playerId);
  if (!row) return { ok: false, code: "NOT_IN_XV" };
  const league = row.slot_group;
  if (xvSlotLocked(gameweek, league, now)) return { ok: false, code: "CAPTAIN_LOCKED" };

  const current = resolveCaptains(lineup).byLeague[league] ?? null;
  const next = (lineup ?? []).map((r) =>
    r.slot_group === league ? { ...r, is_captain: r.player_id === playerId } : r,
  );
  return {
    ok: true,
    noop: current === playerId && Boolean(row.is_captain),
    league,
    previousPlayerId: current && current !== playerId ? current : null,
    lineup: next,
  };
}

/** Captain strip: one entry per country, in country order. */
export function captainStrip(byLeague, playersById) {
  return ULTIMA_LEAGUES.map((league) => {
    const id = byLeague?.[league] ?? null;
    return { league, playerId: id, name: id ? (playersById.get(id)?.name ?? null) : null };
  });
}

/** Whether a country's captain can still be changed. */
export function captainLocked(gameweek, league, now = Date.now()) {
  return xvSlotLocked(gameweek, league, now);
}
