import { filterByColours } from "./colour-veto.js";
import { clubsForScope, normalizeLeagueScope } from "./scope.js";
import { vetoCount } from "./survival.js";

/**
 * Eligible clubs before ranking. Scope, then owned, then shirt colour, then
 * Heart/Mind/Soul hard contradictions. Senses never restore a removed club.
 *
 * @param {object[]} clubs
 * @param {{
 *   leagueScope?: unknown;
 *   ownedSlugs?: string[];
 *   hatedColors?: unknown;
 *   scores?: (number|null)[];
 * }} opts
 */
export function buildCandidateSet(clubs, opts = {}) {
  const scope = normalizeLeagueScope(opts.leagueScope);
  const owned = new Set(opts.ownedSlugs ?? []);
  let list = clubsForScope(clubs ?? [], scope).filter(
    (club) => !owned.has(club.slug),
  );
  const { pool, color2Kept, colors } = filterByColours(list, opts.hatedColors);
  list = pool;

  const scores = opts.scores;
  const hasHms = Array.isArray(scores) && scores.some((s) => s != null);
  if (hasHms) {
    list = list.filter((club) => vetoCount(scores, club, null) === 0);
  }

  return { list, color2Kept, colors };
}
