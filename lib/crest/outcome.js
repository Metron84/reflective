/**
 * One result for the screen. Built for is the swipe ranking.
 * Born to is the roots mass. The lean score decides which one the line names.
 */

import { CLUB_BY_SLUG } from "./clubs.js";
import { RESULT_COUNTRIES } from "./competitions.js";
import { DEFAULT_ALPHA, decidingCards, rankClubs, suitOf } from "./engine.js";
import { inPool } from "./pools.js";
import { matchPercent } from "./report.js";
import { bornTo } from "./roots.js";

const leagueName = (club) => club.division || club.league || club.competition || "";

function pyramidCountries(ranked) {
  const countries = [];
  for (const group of RESULT_COUNTRIES) {
    const leagues = [];
    for (const league of group.leagues) {
      const hit = ranked.find((row) => leagueName(row.club) === league.competition) || null;
      if (!hit) continue;
      leagues.push({
        competition: league.competition,
        label: league.label,
        top: pack(hit),
      });
    }
    if (leagues.length) countries.push({ country: group.country, leagues });
  }
  return countries;
}

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
  const bornClub = born?.slug ? CLUB_BY_SLUG.get(born.slug) || null : null;
  const bornRank = bornClub ? rowFor(bornClub, answers) : null;
  const bornOutside = Boolean(bornClub && stake && !inPool(bornClub.slug, stake));

  let leanWinner = "built";
  if (bornClub && built && bornRank && !bornOutside && bornRank.score > built.score) {
    leanWinner = "born";
  }

  const board = rankClubs(answers, DEFAULT_ALPHA, { group: null, stake, colour: null, competition: null });
  const countries = pyramidCountries(board);

  return {
    ranked,
    built: built ? pack(built) : null,
    runnerUp: runner ? pack(runner) : null,
    closeCall: Boolean(built && runner && matchPercent(built.score) - matchPercent(runner.score) < 3),
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
          league: bornClub ? leagueName(bornClub) : "",
          color: bornClub?.color || null,
        }
      : null,
    same: Boolean(bornClub && built && bornClub.slug === built.club.slug),
    leanWinner: born && !born.typed ? leanWinner : "built",
    bornOutside,
    countries,
    noRoots: !born,
  };
}

/**
 * Suit for one club, including a roots club outside the want pool.
 *
 * @param {import("./clubs.js").CrestClub} club
 * @param {import("./engine.js").CrestAnswer[]} answers
 */
function rowFor(club, answers) {
  const score = suitOf(club, answers);
  return { club, logLikelihood: score, score, probability: score };
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
