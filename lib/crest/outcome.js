/**
 * One result for the screen. Built for is the swipe ranking.
 * Born to is the roots mass. The lean score decides which one the line names.
 */

import { CLUB_BY_SLUG } from "./clubs.js";
import { CONFIDENT_RATIO, DEFAULT_ALPHA, decidingCards, rankClubs } from "./engine.js";
import { matchPercent } from "./report.js";
import { bornTo, leanScore, loyaltyLambda, priorMass, rootProbability } from "./roots.js";

const RESULT_REGIONS = ["England", "Germany", "Italy", "Spain", "France", "Rest of the World"];
const SUBREGIONS = ["Rest of Europe", "Arab world"];

/**
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {{ group?: string|null, stake?: string|null, roots?: import("./roots.js").CrestRoots|null }} [options]
 */
export function buildOutcome(answers, options = {}) {
  const group = options.group || null;
  const stake = options.stake || null;
  const roots = options.roots || null;
  const ranked = rankClubs(answers, DEFAULT_ALPHA, { group, stake, colour: null, competition: null });
  const built = ranked[0] || null;
  const runner = ranked[1] || null;
  const born = bornTo(roots);
  const mass = priorMass(roots);
  const lambda = loyaltyLambda(roots);
  const uniform = mass.size === 0;
  const n = ranked.length;
  const bornClub = born?.slug ? CLUB_BY_SLUG.get(born.slug) || null : null;
  const bornRank = bornClub ? rowFor(bornClub, ranked, answers, stake) : null;

  let leanWinner = "built";
  if (bornClub && built && bornRank) {
    const bornLean = leanOf(bornRank, mass, lambda, n, uniform);
    const builtLean = leanOf(built, mass, lambda, n, uniform);
    if (bornLean > builtLean) leanWinner = "born";
  }

  const regions = RESULT_REGIONS.map((region) => {
    const inRegion = ranked.filter((row) => row.club.region === region);
    return {
      region,
      top: inRegion[0] ? pack(inRegion[0]) : null,
      sub:
        region === "Rest of the World"
          ? SUBREGIONS.map((subregion) => {
              const hit = inRegion.find((row) => row.club.subregion === subregion) || null;
              return { subregion, top: hit ? pack(hit) : null };
            })
          : null,
    };
  });

  return {
    ranked,
    built: built ? pack(built) : null,
    runnerUp: runner ? pack(runner) : null,
    closeCall: Boolean(built && runner && built.probability < CONFIDENT_RATIO * runner.probability),
    deciding: decidingFrom(built, runner, answers, stake),
    born: born
      ? {
          slug: born.slug,
          name: born.name,
          typed: Boolean(born.typed),
          mass: born.mass,
          percentage: bornRank ? matchPercent(bornRank.score) : null,
          region: bornClub?.region || null,
          subregion: bornClub?.subregion || null,
          color: bornClub?.color || null,
        }
      : null,
    same: Boolean(bornClub && built && bornClub.slug === built.club.slug),
    leanWinner: born && !born.typed ? leanWinner : "built",
    lambda,
    regions,
    noRoots: !born,
  };
}

/**
 * @param {import("./engine.js").CrestRank} row
 * @param {Map<string, number>} mass
 * @param {number} lambda
 * @param {number} n
 * @param {boolean} uniform
 */
function leanOf(row, mass, lambda, n, uniform) {
  return leanScore(lambda, rootProbability(row.club.slug, mass, n, uniform), row.logLikelihood);
}

/**
 * @param {import("./clubs.js").CrestClub} club
 * @param {import("./engine.js").CrestRank[]} ranked
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {string|null} stake
 */
function rowFor(club, ranked, answers, stake) {
  const found = ranked.find((row) => row.club.slug === club.slug);
  if (found) return found;
  return (
    rankClubs(answers, DEFAULT_ALPHA, { clubs: [club], stake, group: null, colour: null, competition: null })[0] ||
    null
  );
}

/**
 * @param {import("./engine.js").CrestRank} row
 */
function pack(row) {
  return {
    slug: row.club.slug,
    name: row.club.name,
    region: row.club.region,
    subregion: row.club.subregion || null,
    country: row.club.country,
    league: row.club.division || row.club.league || row.club.competition || "",
    city: row.club.city,
    color: row.club.color || null,
    percentage: matchPercent(row.score),
    probability: row.probability,
    score: row.score,
    logLikelihood: row.logLikelihood,
  };
}

/**
 * @param {import("./engine.js").CrestRank|null} built
 * @param {import("./engine.js").CrestRank|null} runner
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {string|null} stake
 */
function decidingFrom(built, runner, answers, stake) {
  if (!built || !runner) return [];
  return decidingCards(built.club, runner.club, answers, DEFAULT_ALPHA, stake).map((row) => ({
    id: row.card.id,
    question: row.card.q || row.card.question,
    answer: answerLabel(row.card, row.value),
    gap: row.gap,
  }));
}

/**
 * @param {import("./cards.js").CrestCard} card
 * @param {1|0|-1} value
 */
function answerLabel(card, value) {
  if (value === 0) return "Both";
  if (value === card.leftValue) return card.L || card.leftLabel;
  return card.R || card.rightLabel;
}
