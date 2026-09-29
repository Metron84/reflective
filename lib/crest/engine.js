/**
 * The Crest scoring engine, v2. Pure functions, no React, no DOM.
 *
 * Every swipe is treated as evidence. A club's score is the log-likelihood of
 * the person's answers given the club's blended facet values, so a club that
 * is strongly on the wrong side of one answer pays for it, and a club that is
 * mildly on the right side of everything does not win by default.
 *
 * Facets 0 (winning), 3 (meaning), 8 (reach) and 11 (purpose) move together
 * across the database (|r| 0.5 to 0.74). They are still scored separately:
 * folding them into one Stature axis was tested and cost six points of
 * recovery (own-club hit@5 49% to 43%), because the likelihood model does not
 * double-count correlated evidence the way a weighted mean does. The deck
 * carries the correlation instead, with 3.0 of 15 weight across the four.
 */

import { CARDS, PART_BOUNDS, PART_WEIGHT, TOTAL } from "./cards.js";
import { CLUBS } from "./clubs.js";
import { FACETS } from "./facets.js";
import { lifeOrder, stakeCoeff } from "./stakes.js";
import {
  CREST_COMPETITION_LABEL,
  CREST_COMPETITIONS,
  OTHER_COMPETITION,
  OTHER_COMPETITION_LABEL,
} from "./competitions.js";

/**
 * @typedef {{cardId: number, value: 1|0|-1}} CrestAnswer
 * @typedef {{v: number[], w: number[]}} CrestUserVector
 * @typedef {import("./clubs.js").CrestClub} CrestClub
 * @typedef {{club: CrestClub, score: number, probability: number, logLikelihood: number}} CrestRank
 * @typedef {{facet: import("./facets.js").CrestFacet, card: import("./cards.js").CrestCard, userPhrase: string, clubPhrase: string}} CrestArrivalFlag
 * @typedef {{group?: string|null, clubs?: CrestClub[], colour?: string|null, competition?: string|null, stake?: string|null}} CrestOptions
 */

/** A club within this of 0 on a Life facet counts as a match. */
export const LIFE_DEAD = 0.2;

/** Clubs must match at least this many of the five Life poles to stay in the play pool. */
export const LIFE_NEED = 4;

/** Play pool never drops below this many clubs. */
export const PLAY_FLOOR = 3;

/** Same-side cuts cannot remove the current top this many clubs. */
export const PLAY_PROTECT = 3;

/**
 * Ranking model. `likelihood` is z-scored evidence. `legacy` is the raw-blend
 * steepness model. Display tracks always use raw blend either way.
 * @type {'likelihood'|'legacy'}
 */
export let SCORING_MODE = "likelihood";

/**
 * @param {'likelihood'|'legacy'} mode
 */
export function setScoringMode(mode) {
  SCORING_MODE = mode === "legacy" ? "legacy" : "likelihood";
}

/** Steepness of the z-scored likelihood. */
export const LIKELIHOOD_K = 1.7;

/** Default self/others blend. Self leads; others corrects the club's own myth. */
export const DEFAULT_ALPHA = 0.6;

/** Blend used by the "through rival eyes" re-rank. */
export const RIVAL_ALPHA = 0.2;

/**
 * Steepness of the answer model on the -1..1 scale. At 5, a club sitting at
 * 0.3 on a facet is expected to pick that pole about 82 percent of the time,
 * at 0.6 about 95 percent. Thin-file clubs (confidence 0.6) use 5 * 0.6.
 */
export const STEEPNESS = 5;

/**
 * Kept for callers that still import it. Colour taps now filter the pool
 * to that family. A soft bonus was too weak to unseat a confident leader.
 */
export const COLOUR_BONUS = 1.5;

/** Leader must be this many times more probable than the runner-up to be shown alone. */
export const CONFIDENT_RATIO = 1.5;

/**
 * Facets that make up club stature (glory, global, winning). Not folded in
 * scoring; used by the result copy to name what a cluster shares.
 */
export const STATURE_FACETS = [0, 3, 8, 11];

/**
 * Colour families that get a row on the result screen, in display order.
 * White is excluded on purpose: 96 of 184 shirts carry it.
 */
export const COLOUR_FAMILIES = [
  "red",
  "blue",
  "sky blue",
  "black",
  "yellow",
  "green",
  "orange",
  "purple",
  "pink",
  "brown",
];

/**
 * Weighted mean of pole values per facet. Kept for the result copy and for
 * callers that want the raw profile; scoring no longer uses it.
 *
 * @param {CrestAnswer[]} answers
 * @param {string|null} [stakeId]
 * @returns {CrestUserVector}
 */
export function userVector(answers, stakeId = null) {
  const s = Array(12).fill(0);
  const w = Array(12).fill(0);
  for (const answer of answers) {
    const card = CARDS.find((c) => c.id === answer.cardId);
    if (!card) continue;
    const weight = cardWeight(card, stakeId);
    s[card.facet] += answer.value * weight;
    w[card.facet] += weight;
  }
  return { v: s.map((sum, i) => (w[i] ? sum / w[i] : 0)), w };
}

/**
 * Part weight times the chip coefficient for this card's room.
 *
 * @param {import("./cards.js").CrestCard} card
 * @param {string|null|undefined} stakeId
 */
export function cardWeight(card, stakeId) {
  return PART_WEIGHT[card.part] * stakeCoeff(stakeId, card.facet);
}

/**
 * Blend a club's self and others scores on one facet. Where one voice has no
 * evidence (mask false) the other is used alone. Neither, 0.
 *
 * @param {CrestClub} club
 * @param {number} facet
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @returns {number}
 */
export function blend(club, facet, alpha = DEFAULT_ALPHA) {
  const hasSelf = club.selfMask ? club.selfMask[facet] : true;
  const hasOthers = club.othersMask ? club.othersMask[facet] : true;
  if (hasSelf && hasOthers) return alpha * club.self[facet] + (1 - alpha) * club.others[facet];
  if (hasSelf) return club.self[facet];
  if (hasOthers) return club.others[facet];
  return 0;
}

/**
 * A club's value on the facet a card reads. Alias of `blend`, kept as the
 * single point where a different axis model could be plugged in.
 *
 * @param {CrestClub} club
 * @param {number} facet
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @returns {number}
 */
export function axisValue(club, facet, alpha = DEFAULT_ALPHA) {
  return blend(club, facet, alpha);
}

function voiceStats(voice, maskKey) {
  const means = [];
  const sds = [];
  for (let facet = 0; facet < 12; facet++) {
    const vals = CLUBS.filter((club) => (club[maskKey] ? club[maskKey][facet] : true)).map(
      (club) => club[voice][facet],
    );
    const n = vals.length || 1;
    const mean = vals.reduce((sum, v) => sum + v, 0) / n;
    const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
    means.push(mean);
    sds.push(Math.sqrt(variance) || 1);
  }
  return { means, sds };
}

const SELF_STATS = voiceStats("self", "selfMask");
const OTHERS_STATS = voiceStats("others", "othersMask");

/**
 * Z-score of one voice on one facet, centred on clubs that have evidence.
 *
 * @param {CrestClub} club
 * @param {number} facet
 * @param {'self'|'others'} voice
 */
export function zVoice(club, facet, voice) {
  const stats = voice === "self" ? SELF_STATS : OTHERS_STATS;
  return (club[voice][facet] - stats.means[facet]) / stats.sds[facet];
}

/**
 * Blended z on one facet. Empty voice falls back to the other.
 *
 * @param {CrestClub} club
 * @param {number} facet
 */
export function zClub(club, facet) {
  const hasSelf = club.selfMask ? club.selfMask[facet] : true;
  const hasOthers = club.othersMask ? club.othersMask[facet] : true;
  if (hasSelf && hasOthers) return 0.6 * zVoice(club, facet, "self") + 0.4 * zVoice(club, facet, "others");
  if (hasSelf) return zVoice(club, facet, "self");
  if (hasOthers) return zVoice(club, facet, "others");
  return 0;
}

/**
 * Euclidean norm of the club's 12-facet z vector. Tiebreak only.
 *
 * @param {CrestClub} club
 */
export function zNorm(club) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const z = zClub(club, i);
    sum += z * z;
  }
  return Math.sqrt(sum);
}

function confidenceOf(club) {
  return typeof club.confidence === "number" ? club.confidence : 1;
}

function steepness(club) {
  return STEEPNESS * confidenceOf(club);
}

function choiceAxis(club, card, alpha) {
  return SCORING_MODE === "likelihood" ? zClub(club, card.facet) : axisValue(club, card.facet, alpha);
}

function choiceSteep(club) {
  return SCORING_MODE === "likelihood" ? LIKELIHOOD_K * confidenceOf(club) : steepness(club);
}

/**
 * Three-way probabilities for left, right, and Both. Both peaks when the club
 * sits near 0 on the facet.
 *
 * @param {CrestClub} club
 * @param {import("./cards.js").CrestCard} card
 * @param {number} alpha
 * @returns {{left: number, right: number, both: number}}
 */
function choiceProbs(club, card, alpha) {
  const axis = choiceAxis(club, card, alpha);
  const k = choiceSteep(club);
  const leftLogit = k * axis * card.leftValue;
  const rightLogit = k * axis * -card.leftValue;
  const bothLogit = -k * Math.abs(axis);
  const max = Math.max(leftLogit, rightLogit, bothLogit);
  const left = Math.exp(leftLogit - max);
  const right = Math.exp(rightLogit - max);
  const both = Math.exp(bothLogit - max);
  const z = left + right + both || 1;
  return { left: left / z, right: right / z, both: both / z };
}

/**
 * Probability that this club's fan answers `value` on this card.
 *
 * @param {CrestClub} club
 * @param {import("./cards.js").CrestCard} card
 * @param {1|0|-1} value pole value, already in facet terms. 0 is Both.
 * @param {number} alpha
 */
function answerProbability(club, card, value, alpha) {
  const p = choiceProbs(club, card, alpha);
  if (value === 0) return p.both;
  if (value === card.leftValue) return p.left;
  return p.right;
}

/**
 * Per-card log-likelihood terms for one club.
 *
 * @param {CrestClub} club
 * @param {CrestAnswer[]} answers
 * @param {number} alpha
 * @returns {{card: import("./cards.js").CrestCard, value: 1|0|-1, term: number}[]}
 */
function cardTerms(club, answers, alpha, stakeId) {
  const terms = [];
  for (const answer of answers) {
    const card = CARDS.find((c) => c.id === answer.cardId);
    if (!card) continue;
    const p = answerProbability(club, card, answer.value, alpha);
    terms.push({
      card,
      value: answer.value,
      term: cardWeight(card, stakeId) * Math.log(Math.max(p, 1e-9)),
    });
  }
  return terms;
}

function pool(options = {}) {
  let clubs = options.clubs || CLUBS;
  if (options.group) clubs = clubs.filter((club) => club.group === options.group);
  if (options.colour) {
    clubs = clubs.filter((club) => club.colourFamilies && club.colourFamilies.includes(options.colour));
  }
  if (options.competition) {
    clubs = clubs.filter((club) => club.competition === options.competition);
  }
  return clubs;
}

function answersForPart(answers, part) {
  return answers.filter((answer) => {
    const card = CARDS.find((c) => c.id === answer.cardId);
    return card && card.part === part;
  });
}

/**
 * How many Life poles this club shares with the person. Near-zero facets count
 * as a match so mixed clubs are not expelled on a metaphor.
 *
 * @param {CrestClub} club
 * @param {CrestAnswer[]} lifeAnswers
 * @param {number} [alpha=DEFAULT_ALPHA]
 */
export function lifeMatchScore(club, lifeAnswers, alpha = DEFAULT_ALPHA) {
  let score = 0;
  for (const answer of lifeAnswers) {
    const card = CARDS.find((c) => c.id === answer.cardId);
    if (!card) continue;
    if (answer.value === 0) {
      score += 1;
      continue;
    }
    const value = blend(club, card.facet, alpha);
    if (Math.abs(value) < LIFE_DEAD || Math.sign(value) === Math.sign(answer.value)) score += 1;
  }
  return score;
}

function lifeGate(scoped, lifeAnswers, alpha, need = LIFE_NEED) {
  return scoped.filter((club) => lifeMatchScore(club, lifeAnswers, alpha) >= need);
}

function clearlyOpposite(club, card, value, alpha) {
  const axis = blend(club, card.facet, alpha);
  if (Math.abs(axis) < LIFE_DEAD) return false;
  return Math.sign(axis) !== Math.sign(value);
}

function applyLaterCuts(clubs, answers, alpha, options) {
  const later = answers.filter((answer) => {
    const card = CARDS.find((c) => c.id === answer.cardId);
    return card && card.part >= 2;
  });
  if (!later.length) return clubs;

  const life = answersForPart(answers, 1);
  let current = clubs;

  for (let i = 0; i < later.length; i++) {
    const soFar = [...life, ...later.slice(0, i + 1)];
    const ranked = rankClubs(soFar, alpha, { ...options, clubs: current });
    const protect = new Set(ranked.slice(0, PLAY_PROTECT).map((row) => row.club.slug));
    const card = CARDS.find((c) => c.id === later[i].cardId);
    if (!card) continue;
    if (later[i].value === 0) continue;

    const next = current.filter(
      (club) => protect.has(club.slug) || !clearlyOpposite(club, card, later[i].value, alpha),
    );
    if (next.length >= PLAY_FLOOR) {
      current = next;
    } else {
      current = ranked.slice(0, PLAY_FLOOR).map((row) => row.club);
    }
  }
  return current;
}

/**
 * Clubs the hero race may still pick from. Life never cuts until all five
 * living cards are in. Colour and league maps do not use this list.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @returns {CrestClub[]}
 */
export function playPool(answers, alpha = DEFAULT_ALPHA, options = {}) {
  const scoped = pool({ ...options, clubs: undefined });
  const lifeAnswers = answersForPart(answers, 1);
  if (lifeAnswers.length < 5) return scoped;

  let clubs = lifeGate(scoped, lifeAnswers, alpha, LIFE_NEED);
  if (!clubs.length) clubs = lifeGate(scoped, lifeAnswers, alpha, LIFE_NEED - 1);
  if (!clubs.length) clubs = scoped;

  return applyLaterCuts(clubs, answers, alpha, options);
}

/**
 * Rank clubs against the answers, most likely first.
 *
 * `score` is the geometric-mean per-weight agreement, 0 to 1, for display as
 * a percentage. `probability` is the softmax over the pool and drives the
 * confident/undecided rule. With no answers every club is equally likely.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @returns {CrestRank[]}
 */
export function rankClubs(answers, alpha = DEFAULT_ALPHA, options = {}) {
  const clubs = pool(options);
  const stakeId = options.stake || null;
  const totalWeight = answers.reduce((sum, a) => {
    const card = CARDS.find((c) => c.id === a.cardId);
    return sum + (card ? cardWeight(card, stakeId) : 0);
  }, 0);

  const rows = clubs.map((club) => {
    let logLikelihood = cardTerms(club, answers, alpha, stakeId).reduce((sum, t) => sum + t.term, 0);
    return { club, logLikelihood, score: totalWeight ? Math.exp(logLikelihood / totalWeight) : 0.5 };
  });

  const max = rows.reduce((m, r) => Math.max(m, r.logLikelihood), -Infinity);
  const z = rows.reduce((sum, r) => sum + Math.exp(r.logLikelihood - max), 0);
  for (const row of rows) row.probability = Math.exp(row.logLikelihood - max) / z;

  return rows.sort((a, b) => {
    if (Math.abs(a.logLikelihood - b.logLikelihood) >= 1e-9) {
      return b.logLikelihood - a.logLikelihood;
    }
    const na = zNorm(a.club);
    const nb = zNorm(b.club);
    if (Math.abs(na - nb) >= 1e-9) return nb - na;
    return a.club.name.localeCompare(b.club.name);
  });
}

function entropy(ps) {
  let h = 0;
  for (const p of ps) if (p > 0) h -= p * Math.log(p);
  return h;
}

/**
 * Next unused card, or null after 18 answers.
 * Part 1 (life) follows the chip's queue, or 1 to 5 when there is no chip.
 * Parts 2 and 3 pick the unused card in the current part with the highest
 * expected information gain, weighted by the chip coefficient.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @returns {{card: import("./cards.js").CrestCard, reason: string}|null}
 */
export function nextCard(answers, alpha = DEFAULT_ALPHA, options = {}) {
  const n = answers.length;
  if (n >= TOTAL) return null;
  const used = new Set(answers.map((a) => a.cardId));

  if (n < PART_BOUNDS[1][1]) {
    const card =
      lifeOrder(options.stake)
        .map((id) => CARDS.find((c) => c.id === id))
        .find((row) => row && !used.has(row.id)) ||
      CARDS.find((c) => c.part === 1 && !used.has(c.id));
    if (!card) return null;
    return {
      card,
      reason: options.stake
        ? "Life cards follow what you tapped."
        : "Life cards come in a fixed order for everyone.",
    };
  }

  const part = n < PART_BOUNDS[2][1] ? 2 : 3;
  const ranked = rankClubs(answers, alpha, { ...options, clubs: playPool(answers, alpha, options) });
  const prior = ranked.map((r) => r.probability);
  const h0 = entropy(prior);

  let best = null;
  let bestGain = -Infinity;

  for (const card of CARDS) {
    if (card.part !== part || used.has(card.id)) continue;
    const given = ranked.map((r) => choiceProbs(r.club, card, alpha));
    const pLeft = prior.reduce((sum, p, i) => sum + p * given[i].left, 0);
    const pRight = prior.reduce((sum, p, i) => sum + p * given[i].right, 0);
    const pBoth = prior.reduce((sum, p, i) => sum + p * given[i].both, 0);
    const postLeft = prior.map((p, i) => (p * given[i].left) / (pLeft || 1));
    const postRight = prior.map((p, i) => (p * given[i].right) / (pRight || 1));
    const postBoth = prior.map((p, i) => (p * given[i].both) / (pBoth || 1));
    const gain =
      stakeCoeff(options.stake, card.facet) *
      (h0 - (pLeft * entropy(postLeft) + pRight * entropy(postRight) + pBoth * entropy(postBoth)));
    if (gain > bestGain) {
      bestGain = gain;
      best = card;
    }
  }

  if (!best) return null;
  return {
    card: best,
    reason: `Picked because it tells us most about your closest clubs on ${FACETS[best.facet].label}.`,
  };
}

/**
 * Phrase for a pole value. Zero and positive use the right phrase.
 *
 * @param {number} facet
 * @param {number} value
 */
function phraseFor(facet, value) {
  if (value === 0) return "both";
  return FACETS[facet].phrases[value < 0 ? 0 : 1];
}

/**
 * Arrival copy for the top club.
 *
 * `confident` is true when the leader is CONFIDENT_RATIO times more probable
 * than the runner-up; otherwise the screen should show both. `greenFlags` are
 * the two answers that counted most for the club, `rub` the one that counted
 * most against it.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 */
export function arrivalSummary(answers, alpha = DEFAULT_ALPHA, options = {}) {
  const ranked = rankClubs(answers, alpha, {
    ...options,
    clubs: options.clubs || playPool(answers, alpha, options),
  });
  const [top, second] = ranked;
  if (!top) {
    return {
      club: CLUBS[0],
      score: 0.5,
      probability: 0,
      confident: false,
      runnerUp: null,
      greenFlags: [],
      rub: null,
      ranked: [],
    };
  }
  const user = userVector(answers, options.stake);
  const byFacet = [];
  const seen = new Set();
  for (const answer of answers) {
    const card = CARDS.find((c) => c.id === answer.cardId);
    if (!card || seen.has(card.facet)) continue;
    seen.add(card.facet);
    const them = blend(top.club, card.facet, alpha);
    byFacet.push({
      card,
      value: answer.value,
      gap: Math.abs(user.v[card.facet] - them),
    });
  }
  const byGap = [...byFacet].sort((a, b) => a.gap - b.gap);

  const flag = (t) => ({
    facet: FACETS[t.card.facet],
    card: t.card,
    userPhrase: phraseFor(t.card.facet, t.value),
    clubPhrase: phraseFor(t.card.facet, blend(top.club, t.card.facet, alpha)),
  });

  return {
    club: top.club,
    score: top.score,
    probability: top.probability,
    confident: !second || top.probability >= CONFIDENT_RATIO * second.probability,
    runnerUp: second ? second.club : null,
    greenFlags: byGap.slice(0, 2).map(flag),
    rub: byGap.length ? flag(byGap[byGap.length - 1]) : null,
    ranked,
  };
}

/**
 * Last-room ranking used by arrival, colour and league lists. Same order
 * and same share as Your club.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} alpha
 * @param {CrestOptions} options
 */
function lastRoomRanked(answers, alpha, options) {
  return rankClubs(answers, alpha, {
    ...options,
    colour: null,
    competition: null,
    clubs: options.clubs || playPool(answers, alpha, { ...options, colour: null, competition: null }),
  });
}

/**
 * The colour map for the result screen: for each colour family present in the
 * last room, the closest clubs wearing it, in last-room order.
 * Families are ordered by the rank of their best club.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @param {number} [perFamily=3]
 * @returns {{family: string, clubs: CrestRank[]}[]}
 */
export function colourMap(answers, alpha = DEFAULT_ALPHA, options = {}, perFamily = 5) {
  const ranked = lastRoomRanked(answers, alpha, options);
  const rows = [];
  for (const family of COLOUR_FAMILIES) {
    const clubs = ranked.filter((r) => r.club.colourFamilies && r.club.colourFamilies.includes(family));
    if (!clubs.length) continue;
    rows.push({ family, clubs: clubs.slice(0, perFamily), bestRank: ranked.indexOf(clubs[0]) });
  }
  return rows.sort((a, b) => a.bestRank - b.bestRank).map(({ family, clubs }) => ({ family, clubs }));
}

/**
 * The league map for the result screen: for each competition present in the
 * last room, the closest clubs in it, in last-room order.
 * Rows are ordered by the rank of their best club. Clubs with no competition
 * sit in a final Other row.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @param {number} [perCompetition=5]
 * @returns {{competition: string, label: string, clubs: CrestRank[]}[]}
 */
export function leagueMap(answers, alpha = DEFAULT_ALPHA, options = {}, perCompetition = 5) {
  const ranked = lastRoomRanked(answers, alpha, options);
  const rows = [];
  for (const competition of CREST_COMPETITIONS) {
    const clubs = ranked.filter((r) => r.club.competition === competition);
    if (!clubs.length) continue;
    rows.push({
      competition,
      label: CREST_COMPETITION_LABEL[competition] || competition,
      clubs: clubs.slice(0, perCompetition),
      bestRank: ranked.indexOf(clubs[0]),
    });
  }
  const other = ranked.filter((r) => !r.club.competition);
  if (other.length) {
    rows.push({
      competition: OTHER_COMPETITION,
      label: OTHER_COMPETITION_LABEL,
      clubs: other.slice(0, perCompetition),
      bestRank: ranked.indexOf(other[0]),
    });
  }
  return rows
    .sort((a, b) => a.bestRank - b.bestRank)
    .map(({ competition, label, clubs }) => ({ competition, label, clubs }));
}

/**
 * Clubs in the same blood as the top club: within `gap` log-likelihood of it.
 *
 * @param {CrestRank[]} ranked
 * @param {number} [gap=0.4]
 * @returns {CrestClub[]}
 */
export function cluster(ranked, gap = 0.4) {
  if (!ranked.length) return [];
  const top = ranked[0].logLikelihood;
  return ranked.filter((r) => top - r.logLikelihood <= gap).map((r) => r.club);
}
