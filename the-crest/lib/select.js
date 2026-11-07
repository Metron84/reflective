/**
 * Panel routing: flat rawFit rank, hard exclusions, diversification, admire, red flag.
 * Colour / senses / character / veto are ignored in Phase 1.
 */
import { nearestArchetype } from "./archetype.js";
import { countryForClub, CREST_COUNTRIES } from "./club-country.js";
import { clubsForScope, normalizeLeagueScope } from "./scope.js";
import { reasonFor } from "./reason.js";
import {
  compareRankEntries,
  displayPercent,
  getDimensionWeights,
  isNearNeutral,
  pillarFit,
  rank,
  rawFit,
  similarity,
} from "./scoring.js";
import { DIMS } from "./quiz-content.js";
import { describeMatchClub, TIER_B_PRIMARY_MARGIN, tierOf } from "./tier.js";

/** Neighbours must sit within this raw_fit of the primary. */
export const NEIGHBOUR_BAND = 0.12;

/** Soul pillar similarity below this triggers a red-flag presentation. */
export const RED_FLAG_SOUL = 0.35;

export const CALIBRATION_ANCHORS = ["real-madrid", "everton", "st-pauli"];

export const NEUTRAL_RANGE_NOTE =
  "Your answers sit near the middle. These three show the range.";

export const LIMITED_BY_EXCLUSIONS_NOTE =
  "Limited by the clubs you set aside.";

/**
 * @typedef {Object} ClubMatch
 * @property {object} club
 * @property {number} raw
 * @property {number} [percent]
 * @property {string} reason
 */

/**
 * @typedef {Object} CrestResult
 * @property {{ name: string; reading: string; lean?: string }} archetype
 * @property {ClubMatch|null} primary
 * @property {ClubMatch[]} neighbours
 * @property {ClubMatch|null} admireFromAfar
 * @property {string|null} admireLine
 * @property {{ club: object; line: string }|null} redFlag
 * @property {boolean} showSampleNotice
 * @property {string|null} emptyMessage
 * @property {string|null} note
 * @property {{ id: string; label: string; match: ClubMatch }[]} byCountry
 */

/**
 * @param {object[]} clubs
 * @param {string[]} ownedSlugs
 * @param {string} [leagueScope]
 */
function eligibleClubs(clubs, ownedSlugs, leagueScope = "all") {
  const scope = normalizeLeagueScope(leagueScope);
  const owned = new Set(ownedSlugs ?? []);
  return clubsForScope(clubs ?? [], scope).filter((c) => !owned.has(c.slug));
}

/**
 * @param {object[]} ranked
 */
function pickPrimaryEntry(ranked) {
  if (!ranked.length) return { primaryEntry: null, demotedTierB: null };

  let primaryEntry = ranked[0];
  const bestTierA = ranked.find((r) => tierOf(r.club) === "A");

  let demotedTierB = null;
  if (
    bestTierA &&
    tierOf(primaryEntry.club) === "B" &&
    primaryEntry.raw <= bestTierA.raw + TIER_B_PRIMARY_MARGIN
  ) {
    demotedTierB = primaryEntry;
    primaryEntry = bestTierA;
  }

  return { primaryEntry, demotedTierB };
}

/**
 * @param {number[]} userVector
 * @param {object} club
 */
export function buildAdmireLine(userVector, club) {
  const name = describeMatchClub(club);
  const mindIdx = [4, 5, 6, 7];
  const clashIdx = [0, 1, 2, 3, 8, 9, 10, 11];

  let bestMind = mindIdx[0];
  let bestMindSim = -1;
  for (const i of mindIdx) {
    const s = similarity(userVector[i], club.vector[i]);
    if (s > bestMindSim) {
      bestMindSim = s;
      bestMind = i;
    }
  }

  let worst = clashIdx[0];
  let worstSim = 2;
  for (const i of clashIdx) {
    const s = similarity(userVector[i], club.vector[i]);
    if (s < worstSim) {
      worstSim = s;
      worst = i;
    }
  }

  const respectedPole =
    club.vector[bestMind] >= 4 ? DIMS[bestMind].high : DIMS[bestMind].low;
  const clashingPole =
    club.vector[worst] >= 4 ? DIMS[worst].high : DIMS[worst].low;

  let feel = "foreign";
  if (
    ["Success", "Results", "Establishment", "Calm"].includes(clashingPole) &&
    club.vector[worst] <= 3
  ) {
    feel = "airless";
  }
  if (
    ["Volatile", "Defiance", "Suffering"].includes(clashingPole) &&
    club.vector[worst] >= 5
  ) {
    feel = "relentless";
  }

  const respected = respectedPole.toLowerCase();
  const clashing = clashingPole.toLowerCase();
  return `${name} — the ${respected} is clear; the ${clashing} would feel ${feel}.`;
}

/**
 * @param {object} club
 */
function redFlagLine(club) {
  const name = describeMatchClub(club);
  return `${name} sits far from you on belonging and meaning. Shown so the distance is visible.`;
}

/**
 * @param {number[]} userVector
 * @param {object[]} clubs
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {string[]} ownedSlugs
 * @param {string|string[]|null} [_hatedColors] ignored in Phase 1
 * @param {object|null} [_personCharacter] ignored in Phase 1
 * @param {string} [leagueScope]
 * @param {(number|null)[]|null} [_sensesAnswers] ignored in Phase 1
 * @returns {CrestResult}
 */
export function selectMatches(
  userVector,
  clubs,
  pillarWeights,
  ownedSlugs = [],
  _hatedColors = null,
  _personCharacter = null,
  leagueScope = "all",
  _sensesAnswers = null,
) {
  const dimWeights = getDimensionWeights(clubs);
  const archetype = nearestArchetype(userVector);
  const fullSlugSet = new Set((clubs ?? []).map((c) => c.slug));

  if (isNearNeutral(userVector)) {
    return neutralAnchorResult(userVector, clubs, pillarWeights, dimWeights, archetype);
  }

  const list = eligibleClubs(clubs, ownedSlugs, leagueScope);
  const ranked = rank(userVector, list, pillarWeights, dimWeights);

  if (!ranked.length) {
    return emptyResult(archetype, clubs, "Every club in the set is one you already support. Your answers still shape your crest and archetype above.");
  }

  const lo = ranked[ranked.length - 1].raw;
  const hi = ranked[0].raw;

  function enrich(entry) {
    return {
      ...entry,
      percent: displayPercent(entry.raw, lo, hi),
      reason: reasonFor(userVector, entry.club, pillarWeights, dimWeights),
    };
  }

  const byCountry = scoreCountryMatches(ranked, enrich);
  const { primaryEntry, demotedTierB } = pickPrimaryEntry(ranked);

  if (!primaryEntry) {
    return emptyResult(archetype, clubs, "Every club in the set is one you already support. Your answers still shape your crest and archetype above.");
  }

  const primary = enrich(primaryEntry);
  let note = null;

  /** @type {Set<string>} */
  let banned = new Set([primary.club.slug]);
  for (const slug of primary.club.exclusion_clubs ?? []) {
    if (fullSlugSet.has(slug)) banned.add(slug);
  }

  /** @type {Set<string>} */
  let chosenClusters = new Set([primary.club.cluster].filter(Boolean));
  /** @type {Set<string>} */
  let chosenCities = new Set(
    [primary.club.city].filter(Boolean).map((c) => String(c).toLowerCase()),
  );

  /** @type {ClubMatch[]} */
  let neighbours = [];

  function tryAddNeighbour(entry, useDiversification) {
    if (neighbours.length >= 2) return false;
    if (banned.has(entry.club.slug)) return false;
    if (entry.club.slug === primary.club.slug) return false;
    if (entry.raw < primary.raw - NEIGHBOUR_BAND) return false;
    if (useDiversification) {
      if (entry.club.cluster && chosenClusters.has(entry.club.cluster)) {
        return false;
      }
      const city = entry.club.city
        ? String(entry.club.city).toLowerCase()
        : "";
      if (city && chosenCities.has(city)) return false;
    }
    neighbours.push(enrich(entry));
    if (entry.club.cluster) chosenClusters.add(entry.club.cluster);
    if (entry.club.city) {
      chosenCities.add(String(entry.club.city).toLowerCase());
    }
    for (const slug of entry.club.exclusion_clubs ?? []) {
      if (fullSlugSet.has(slug)) banned.add(slug);
    }
    return true;
  }

  const pool = ranked.filter((r) => r.club.slug !== primary.club.slug);

  if (demotedTierB) tryAddNeighbour(demotedTierB, true);
  for (const entry of pool) tryAddNeighbour(entry, true);

  if (neighbours.length < 2) {
    note = LIMITED_BY_EXCLUSIONS_NOTE;
    for (const entry of pool) {
      if (neighbours.length >= 2) break;
      if (neighbours.some((n) => n.club.slug === entry.club.slug)) continue;
      tryAddNeighbour(entry, false);
    }
  }

  const shown = new Set([
    primary.club.slug,
    ...neighbours.map((n) => n.club.slug),
  ]);

  const afarCandidates = ranked.filter(
    (r) => !shown.has(r.club.slug) && !banned.has(r.club.slug),
  );

  let admireFromAfar = null;
  let admireLine = null;

  if (afarCandidates.length) {
    const scored = afarCandidates
      .map((r) => ({
        entry: r,
        score:
          pillarFit(userVector, r.club, "Mind") -
          Math.min(
            pillarFit(userVector, r.club, "Heart"),
            pillarFit(userVector, r.club, "Soul"),
          ),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.entry.club.slug.localeCompare(b.entry.club.slug);
      });
    admireFromAfar = {
      ...scored[0].entry,
      reason: reasonFor(
        userVector,
        scored[0].entry.club,
        pillarWeights,
        dimWeights,
      ),
    };
    // No display percent on admire-from-afar
    delete admireFromAfar.percent;
    admireLine = buildAdmireLine(userVector, scored[0].entry.club);
  }

  /** @type {{ club: object; line: string }|null} */
  let redFlag = null;
  const redCandidates = ranked.filter((r) => !shown.has(r.club.slug));
  if (pillarFit(userVector, primary.club, "Soul") < RED_FLAG_SOUL) {
    redFlag = { club: primary.club, line: redFlagLine(primary.club) };
  } else {
    const far = redCandidates
      .map((r) => ({
        club: r.club,
        soul: pillarFit(userVector, r.club, "Soul"),
      }))
      .filter((r) => r.soul < RED_FLAG_SOUL)
      .sort((a, b) => a.soul - b.soul || a.club.slug.localeCompare(b.club.slug));
    if (far.length) {
      redFlag = { club: far[0].club, line: redFlagLine(far[0].club) };
    }
  }

  const displayedClubs = [
    primary.club,
    ...neighbours.map((n) => n.club),
    admireFromAfar?.club,
    redFlag?.club,
    ...byCountry.map((row) => row.match.club),
  ].filter(Boolean);

  const showSampleNotice = displayedClubs.some(
    (c) => c.research_status !== "validated",
  );

  return {
    archetype,
    primary,
    neighbours,
    admireFromAfar,
    admireLine,
    redFlag,
    showSampleNotice,
    emptyMessage: null,
    note,
    byCountry,
  };
}

/**
 * @param {number[]} userVector
 * @param {object[]} clubs
 * @param {{ Heart: number; Mind: number; Soul: number }} pillarWeights
 * @param {number[]} dimWeights
 * @param {{ name: string; reading: string; lean?: string }} archetype
 * @returns {CrestResult}
 */
function neutralAnchorResult(
  userVector,
  clubs,
  pillarWeights,
  dimWeights,
  archetype,
) {
  const bySlug = new Map((clubs ?? []).map((c) => [c.slug, c]));
  const anchors = CALIBRATION_ANCHORS.map((slug) => bySlug.get(slug)).filter(
    Boolean,
  );
  if (anchors.length < 3) {
    return emptyResult(
      archetype,
      clubs,
      "Calibration anchors are missing from the club set.",
    );
  }

  const ranked = anchors
    .map((club) => ({
      club,
      raw: rawFit(userVector, club, pillarWeights, dimWeights),
    }))
    .sort(compareRankEntries);

  const allRaw = rank(userVector, clubs, pillarWeights, dimWeights);
  const lo = allRaw.length ? allRaw[allRaw.length - 1].raw : 0;
  const hi = allRaw.length ? allRaw[0].raw : 1;

  const enriched = ranked.map((entry) => ({
    ...entry,
    percent: displayPercent(entry.raw, lo, hi),
    reason: reasonFor(userVector, entry.club, pillarWeights, dimWeights),
  }));

  return {
    archetype,
    primary: enriched[0],
    neighbours: enriched.slice(1, 3),
    admireFromAfar: null,
    admireLine: null,
    redFlag: null,
    showSampleNotice: enriched.some(
      (e) => e.club.research_status !== "validated",
    ),
    emptyMessage: null,
    note: NEUTRAL_RANGE_NOTE,
    byCountry: [],
  };
}

/**
 * @param {{ name: string; reading: string; lean?: string }} archetype
 * @param {object[]} clubs
 * @param {string} emptyMessage
 * @returns {CrestResult}
 */
function emptyResult(archetype, clubs, emptyMessage) {
  return {
    archetype,
    primary: null,
    neighbours: [],
    admireFromAfar: null,
    admireLine: null,
    redFlag: null,
    showSampleNotice: (clubs ?? []).some(
      (c) => c.research_status !== "validated",
    ),
    emptyMessage,
    note: null,
    byCountry: [],
  };
}

/**
 * Best eligible club in England, Italy, France, Spain, Germany.
 * @param {{ club: object; raw: number }[]} eligible
 * @param {(entry: object) => ClubMatch} enrich
 */
export function pickCountryMatches(eligible, enrich) {
  return scoreCountryMatches(eligible, enrich);
}

function scoreCountryMatches(eligible, enrich) {
  return CREST_COUNTRIES.map((country) => {
    const inCountry = eligible.filter(
      (r) => countryForClub(r.club) === country.id,
    );
    const { primaryEntry } = pickPrimaryEntry(inCountry);
    return {
      id: country.id,
      label: country.label,
      match: primaryEntry ? enrich(primaryEntry) : null,
    };
  }).filter((row) => row.match);
}
