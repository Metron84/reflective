/**
 * The Crest matcher for The Reflective. Scoring lives in engine.js, the same
 * module as Metron84/the-crest. This file re-exports it and keeps the league
 * picks the account uses.
 */

export {
  K,
  DEFAULT_ALPHA,
  RIVAL_ALPHA,
  SCORING_MODE,
  setScoringMode,
  STEEPNESS,
  CONFIDENT_RATIO,
  STATURE_FACETS,
  COLOUR_FAMILIES,
  userVector,
  cardWeight,
  blend,
  axisValue,
  zVoice,
  zClub,
  zNorm,
  cardTerms,
  playPool,
  rankClubs,
  nextCard,
  decidingCards,
  arrivalSummary,
  colourMap,
  leagueMap,
  cluster,
} from "./engine.js";

import { DEFAULT_ALPHA, arrivalSummary, playPool, rankClubs } from "./engine.js";
import { CLUBS } from "./clubs.js";
import { CREST_COMPETITION_LABEL, CREST_COMPETITIONS } from "./competitions.js";

/**
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {number} alpha
 * @param {{ stake?: string|null }} options
 * @param {string} competition
 * @param {import("./clubs.js").CrestClub[]} gated
 */
function rankLeague(answers, alpha, options, competition, gated) {
  const inLeague = gated.filter((club) => (club.division || club.league || club.competition) === competition);
  return rankClubs(answers, alpha, {
    ...options,
    colour: null,
    competition,
    clubs: inLeague.length ? inLeague : undefined,
  });
}

/**
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {string} competition
 * @param {{ stake?: string|null, alpha?: number, gated: import("./clubs.js").CrestClub[] }} opts
 */
function leagueCandidates(answers, competition, opts) {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const stake = opts.stake || null;
  const first = rankLeague(answers, alpha, { stake }, competition, opts.gated);
  const seen = new Set(first.map((row) => row.club.slug));
  const rest = rankClubs(answers, alpha, { stake, colour: null, competition, clubs: undefined }).filter(
    (row) => !seen.has(row.club.slug),
  );
  return [...first, ...rest].map((row) => ({ club: row.club, probability: row.probability }));
}

function rivalPair(rivals, a, b) {
  return (rivals[a] ?? []).includes(b) || (rivals[b] ?? []).includes(a);
}

/**
 * @param {{competition: string, label: string, candidates: {club: import("./clubs.js").CrestClub, probability: number}[]}[]} leagues
 * @param {{home?: import("./clubs.js").CrestClub|null, rivals?: Record<string, string[]>}} [opts]
 */
export function lockLeaguePicks(leagues, opts = {}) {
  const rivals = opts.rivals ?? {};
  const home = opts.home ?? null;
  const locked = home ? [home.slug] : [];
  const picks = new Map();

  const order = leagues
    .map((league, index) => ({ league, index, strength: league.candidates[0]?.probability ?? 0 }))
    .sort((a, b) => b.strength - a.strength || a.index - b.index);

  for (const { league } of order) {
    let pick = null;
    if (home && (home.division || home.league || home.competition) === league.competition) {
      const own = league.candidates.find((c) => c.club.slug === home.slug);
      pick = own ?? { club: home, probability: 0 };
    } else {
      pick = league.candidates.find((c) => !locked.some((slug) => rivalPair(rivals, c.club.slug, slug))) ?? null;
      if (pick) locked.push(pick.club.slug);
    }
    if (pick) picks.set(league.competition, { competition: league.competition, label: league.label, ...pick });
  }
  return leagues.filter((league) => picks.has(league.competition)).map((league) => picks.get(league.competition));
}

/**
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {string} competition
 * @param {{stake?: string|null, scope?: string|null, alpha?: number, gated?: import("./clubs.js").CrestClub[]}} [opts]
 */
export function matchLeague(answers, competition, opts = {}) {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const stake = opts.stake || null;
  const gated =
    opts.gated || playPool(answers, alpha, { group: opts.scope || null, stake, colour: null, competition: null });
  return leagueCandidates(answers, competition, { alpha, stake, gated })[0] ?? null;
}

/**
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {{stake?: string|null, scope?: string|null, alpha?: number, home?: string|null, rivals?: Record<string, string[]>}} [opts]
 */
export function bestClubPerLeague(answers, opts = {}) {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const stake = opts.stake || null;
  const gated = playPool(answers, alpha, { group: opts.scope || null, stake, colour: null, competition: null });

  const leagues = [];
  for (const competition of CREST_COMPETITIONS) {
    const candidates = leagueCandidates(answers, competition, { alpha, stake, gated });
    if (!candidates.length) continue;
    leagues.push({ competition, label: CREST_COMPETITION_LABEL[competition] || competition, candidates });
  }

  const home =
    (opts.home && CLUBS.find((club) => club.slug === opts.home)) ||
    arrivalSummary(answers, alpha, { group: opts.scope || null, stake }).club;

  return lockLeaguePicks(leagues, { home, rivals: opts.rivals }).map(({ competition, label, club }) => ({
    competition,
    label,
    club,
  }));
}
