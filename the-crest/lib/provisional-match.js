import { countryForClub } from "./club-country.js";
import {
  COLOR3_PENALTY,
  isColor3Club,
} from "./colour-veto.js";
import { hexToRgb } from "./color-utils.js";
import { resolveClubGround } from "./club-ground-meta.js";
import { buildCandidateSet } from "./candidates.js";
import { compositionFit } from "./fit.js";
import { comparePathEntries, getDimensionWeights } from "./scoring.js";
import { inBestStratum } from "./survival.js";
import { tierOf, TIER_B_PRIMARY_MARGIN } from "./tier.js";

/** @type {{ Heart: number; Mind: number; Soul: number }} */
export const DEFAULT_PILLAR = { Heart: 0.34, Mind: 0.33, Soul: 0.33 };

/**
 * @param {object[]} ranked
 * @param {Set<string>} owned
 */
function pickPrimaryClub(ranked, owned) {
  const eligible = ranked.filter((r) => !owned.has(r.club.slug));
  if (!eligible.length) return null;

  const stratum = inBestStratum(eligible);
  let primaryEntry = stratum[0];
  const bestTierA = stratum.find((r) => tierOf(r.club) === "A");

  if (
    bestTierA &&
    tierOf(primaryEntry.club) === "B" &&
    primaryEntry.raw <= bestTierA.raw + TIER_B_PRIMARY_MARGIN
  ) {
    primaryEntry = bestTierA;
  }

  return primaryEntry.club;
}

/**
 * Leading club while the quiz is in progress (updates after each affinity or character answer).
 * @param {{ scores: (number|null)[]; pillar: object|null; ownedSlugs: string[]; hatedColors?: string[]|null; hatedColor?: string|null; character?: object|null }} state
 * @param {object[]} clubs
 * @returns {{ club: object; raw: number } | null}
 */
export function provisionalDestination(state, clubs) {
  if (!clubs?.length) return null;
  const hasAffinity = state.scores.some((s) => s != null);
  if (!hasAffinity) return null;

  const { list, color2Kept, colors } = buildCandidateSet(clubs, {
    leagueScope: state.leagueScope,
    ownedSlugs: state.ownedSlugs,
    hatedColors: state.hatedColors ?? state.hatedColor ?? null,
    scores: state.scores,
  });
  if (!list.length) return null;

  const dimWeights = getDimensionWeights(clubs);
  const ranked = list
    .map((club) => {
      const composed = compositionFit(
        state.scores,
        club,
        dimWeights,
        state.sensesAnswers,
      );
      let raw = composed.fit;
      if (isColor3Club(club, colors)) raw *= COLOR3_PENALTY;
      return {
        club,
        raw,
        percent: composed.percent,
        vetoCount: color2Kept.has(club.slug) ? 1 : 0,
      };
    })
    .sort(comparePathEntries)
    .filter((r) => countryForClub(r.club));
  const club = pickPrimaryClub(ranked, new Set());
  if (!club) return null;
  const entry = ranked.find((r) => r.club.slug === club.slug);
  return { club, raw: entry?.raw ?? 0 };
}

/**
 * @param {object | null | undefined} club
 */
export function destinationGlowColors(club) {
  if (!club) {
    return { primary: "216, 35, 42", secondary: "10, 17, 31" };
  }
  const ground = resolveClubGround(club);
  const p = hexToRgb(ground.primary);
  const s = hexToRgb(ground.secondary);
  return {
    primary: p ? `${p.r}, ${p.g}, ${p.b}` : "216, 35, 42",
    secondary: s ? `${s.r}, ${s.g}, ${s.b}` : "10, 17, 31",
  };
}
