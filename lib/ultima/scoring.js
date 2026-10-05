import { CAPTAIN_MULTIPLIER } from "./captains.js";
import {
  ULTIMA_BOLT_MIN_BASE_POINTS,
  ULTIMA_BOLT_MIN_ROUND,
  ULTIMA_DEFAULT_RATING_THRESHOLDS,
} from "./constants.js";

/**
 * Rating band points for one fixture stat row.
 * @param {number|null|undefined} rating
 * @param {{ band1: number, band2: number }} thresholds
 */
export function ratingPoints(rating, thresholds) {
  if (rating == null || Number.isNaN(Number(rating))) return 0;
  const value = Number(rating);
  if (value >= thresholds.band2) return 2;
  if (value >= thresholds.band1) return 1;
  return 0;
}

/**
 * Base points from one fixture appearance (goals, assists, rating).
 * @param {{ goals?: number, assists?: number, rating?: number|null }} stat
 * @param {{ band1: number, band2: number }} thresholds
 */
export function fixtureBasePoints(stat, thresholds) {
  const goals = Number(stat.goals ?? 0);
  const assists = Number(stat.assists ?? 0);
  return goals * 3 + assists + ratingPoints(stat.rating, thresholds);
}

/**
 * Whether a player carries Bolt eligibility (fixed at draft/signing time).
 * @param {{ draftRound?: number|null, undraftedFa?: boolean }} player
 */
export function isBoltEligible(player) {
  if (player.undraftedFa) return true;
  const round = player.draftRound;
  return typeof round === "number" && round >= ULTIMA_BOLT_MIN_ROUND;
}

/**
 * Score one XI slot across one or more fixtures in the gameweek window.
 * @param {Array<{ goals?: number, assists?: number, rating?: number|null }>} fixtureStats
 * @param {{ draftRound?: number|null, undraftedFa?: boolean, league?: string }} player
 * @param {Record<string, { band1: number, band2: number }>} ratingThresholds
 */
export function scoreSlot(fixtureStats, player, ratingThresholds) {
  const league = player.league ?? "pl";
  const thresholds =
    ratingThresholds[league] ?? ULTIMA_DEFAULT_RATING_THRESHOLDS.pl;

  let base = 0;
  for (const stat of fixtureStats) {
    base += fixtureBasePoints(stat, thresholds);
  }

  const boltEligible = isBoltEligible(player);
  const bolt =
    boltEligible && base >= ULTIMA_BOLT_MIN_BASE_POINTS
      ? 2
      : 0;

  return { base, bolt, total: base + bolt, boltEligible, boltAwarded: bolt > 0 };
}

/**
 * Score a full XI. Bench rows are ignored. A row with `captain: true` doubles
 * its base points. Bolt is judged on base before the multiplier and its +2 is
 * added after, so it is never doubled: 6 base captained = 12 + 2 = 14.
 * @param {Array<{ slot: number, player: object, fixtureStats: object[], captain?: boolean }>} lineup
 * @param {Record<string, { band1: number, band2: number }>} ratingThresholds
 */
export function scoreLineup(lineup, ratingThresholds = ULTIMA_DEFAULT_RATING_THRESHOLDS) {
  let baseTotal = 0;
  let boltTotal = 0;
  let captainTotal = 0;
  const slots = lineup.map(({ slot, player, fixtureStats, captain }) => {
    const scored = scoreSlot(fixtureStats, player, ratingThresholds);
    const captainBonus = captain ? scored.base * (CAPTAIN_MULTIPLIER - 1) : 0;
    baseTotal += scored.base;
    boltTotal += scored.bolt;
    captainTotal += captainBonus;
    return {
      slot,
      playerId: player.id ?? player.provider_id,
      ...scored,
      captain: Boolean(captain),
      captainBonus,
      slotTotal: scored.total + captainBonus,
    };
  });

  return {
    slots,
    baseTotal,
    boltTotal,
    captainTotal,
    total: baseTotal + boltTotal + captainTotal,
  };
}
