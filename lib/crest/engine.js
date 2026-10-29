/**
 * The Crest scoring engine.
 *
 * A club's swipe score is the log-likelihood of the answers given that club's
 * blended facet values. One strong miss costs more than being mildly right
 * on everything. There is one ranking of every club in scope. Region, league,
 * and colour rows are filters of that list.
 *
 * Facets 0 (winning), 3 (meaning), 8 (reach) and 11 (purpose) move together
 * across the database. They stay separate. A missing facet is not a zero.
 */

import { allowsBoth, CARDS, deckFor, facetCardCount, findCard, PART_WEIGHT } from "./cards.js";
import { CLUBS } from "./clubs.js";
import { FACETS } from "./facets.js";
import { clubsForStake } from "./pools.js";
import { isStake, stakeCoeff } from "./stakes.js";
import { CREST_COMPETITION_LABEL, CREST_COMPETITIONS } from "./competitions.js";

/**
 * @typedef {{cardId: number, value: 1|0|-1}} CrestAnswer
 * @typedef {{v: number[], w: number[]}} CrestUserVector
 * @typedef {import("./clubs.js").CrestClub} CrestClub
 * @typedef {{club: CrestClub, score: number, probability: number, logLikelihood: number}} CrestRank
 * @typedef {{facet: import("./facets.js").CrestFacet, card: import("./cards.js").CrestCard, userPhrase: string, clubPhrase: string}} CrestArrivalFlag
 * @typedef {{group?: string|null, clubs?: CrestClub[], colour?: string|null, competition?: string|null, stake?: string|null}} CrestOptions
 */

/**
 * Uncalibrated. Steepness is K × confidence.
 */
export const K = 3.0;

/** Default self/others blend. Self leads; others corrects the club's own myth. */
export const DEFAULT_ALPHA = 0.6;

/** Blend used by the "through rival eyes" re-rank. */
export const RIVAL_ALPHA = 0.2;

/**
 * Kept so the bias script can still call it. The quiz always uses K.
 * @type {'likelihood'|'legacy'}
 */
export let SCORING_MODE = "likelihood";

/**
 * @param {'likelihood'|'legacy'} mode
 */
export function setScoringMode(mode) {
  SCORING_MODE = mode === "legacy" ? "legacy" : "likelihood";
}

/** Legacy steepness, used only when setScoringMode("legacy") is on. */
export const STEEPNESS = 5;

/** Leader must be this many times more probable than the runner-up to be shown alone. */
export const CONFIDENT_RATIO = 1.5;

/** Facets that make up club stature. Not folded. Copy only. */
export const STATURE_FACETS = [0, 3, 8, 11];

/**
 * Colour families that get a row on a colour filter, in display order.
 * White is excluded on purpose.
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
 * @param {CrestAnswer[]} answers
 * @param {string|null} [stakeId]
 * @returns {CrestUserVector}
 */
export function userVector(answers, stakeId = null) {
  const s = Array(12).fill(0);
  const w = Array(12).fill(0);
  for (const answer of answers) {
    const row = CARDS.find((c) => c.id === answer.cardId);
    if (!row) continue;
    const weight = cardWeight(row, stakeId);
    s[row.facet] += answer.value * weight;
    w[row.facet] += weight;
  }
  return { v: s.map((sum, i) => (w[i] ? sum / w[i] : 0)), w };
}

/**
 * Part weight × 0.7 when the facet has two cards in the deck × stake coefficient.
 * The stake never changes card order.
 *
 * @param {import("./cards.js").CrestCard} row
 * @param {string|null|undefined} stakeId
 */
export function cardWeight(row, stakeId) {
  const split = facetCardCount(row.facet) >= 2 ? 0.7 : 1;
  return PART_WEIGHT[row.part] * split * stakeCoeff(stakeId, row.facet);
}

/**
 * Suit on one answered trait. Missing club evidence returns null.
 *
 * @param {CrestClub} club
 * @param {import("./cards.js").CrestCard} row
 * @param {1|0|-1} value
 * @returns {number|null}
 */
export function traitSuit(club, row, value) {
  const axis = blend(club, row.facet, 0.5);
  if (axis == null) return null;
  return 1 - Math.abs(value - axis) / 2;
}

/**
 * Mean nearness of this club to the swipes. 1 is the same place. 0 is opposite poles.
 * A trait the club cannot answer drops out. No answers is 0.5.
 *
 * @param {CrestClub} club
 * @param {CrestAnswer[]} answers
 */
export function suitOf(club, answers) {
  let sum = 0;
  let n = 0;
  for (const answer of answers) {
    const row = findCard(answer.cardId);
    if (!row) continue;
    const suit = traitSuit(club, row, answer.value);
    if (suit == null) continue;
    sum += suit;
    n += 1;
  }
  return n ? sum / n : 0.5;
}

/**
 * The answered trait where this club sits closest to the person.
 *
 * @param {CrestClub} club
 * @param {CrestAnswer[]} answers
 */
function strongestSuit(club, answers) {
  let best = -1;
  for (const answer of answers) {
    const row = findCard(answer.cardId);
    if (!row) continue;
    const suit = traitSuit(club, row, answer.value);
    if (suit != null && suit > best) best = suit;
  }
  return best;
}

/**
 * Blend self and others on one facet. One masked voice falls back to the
 * other. Both masked, or neither present, returns null. Null is missing.
 * It is not zero.
 *
 * @param {CrestClub} club
 * @param {number} facet
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @returns {number|null}
 */
export function blend(club, facet, alpha = DEFAULT_ALPHA) {
  const hasSelf = club.selfMask ? Boolean(club.selfMask[facet]) : true;
  const hasOthers = club.othersMask ? Boolean(club.othersMask[facet]) : true;
  if (hasSelf && hasOthers) return alpha * club.self[facet] + (1 - alpha) * club.others[facet];
  if (hasSelf) return club.self[facet];
  if (hasOthers) return club.others[facet];
  return null;
}

/**
 * @param {CrestClub} club
 * @param {number} facet
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @returns {number|null}
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
 * @param {CrestClub} club
 * @param {number} facet
 * @param {'self'|'others'} voice
 */
export function zVoice(club, facet, voice) {
  const stats = voice === "self" ? SELF_STATS : OTHERS_STATS;
  return (club[voice][facet] - stats.means[facet]) / stats.sds[facet];
}

/**
 * Blended z on one facet. A missing facet adds nothing.
 *
 * @param {CrestClub} club
 * @param {number} facet
 */
export function zClub(club, facet) {
  const hasSelf = club.selfMask ? Boolean(club.selfMask[facet]) : true;
  const hasOthers = club.othersMask ? Boolean(club.othersMask[facet]) : true;
  if (hasSelf && hasOthers) return 0.6 * zVoice(club, facet, "self") + 0.4 * zVoice(club, facet, "others");
  if (hasSelf) return zVoice(club, facet, "self");
  if (hasOthers) return zVoice(club, facet, "others");
  return null;
}

/**
 * Euclidean norm of the club's evidenced z vector. Tiebreak only.
 *
 * @param {CrestClub} club
 */
export function zNorm(club) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const z = zClub(club, i);
    if (z == null) continue;
    sum += z * z;
  }
  return Math.sqrt(sum);
}

function confidenceOf(club) {
  return typeof club.confidence === "number" ? club.confidence : 1;
}

function choiceSteep(club) {
  return (SCORING_MODE === "legacy" ? STEEPNESS : K) * confidenceOf(club);
}

/**
 * @param {CrestClub} club
 * @param {import("./cards.js").CrestCard} row
 * @param {number} alpha
 * @returns {{left: number, right: number, both: number}|null}
 */
function choiceProbsFromAxis(axis, row, k) {
  const leftLogit = k * axis * row.leftValue;
  const rightLogit = k * axis * -row.leftValue;
  if (!allowsBoth(row)) {
    const max = Math.max(leftLogit, rightLogit);
    const left = Math.exp(leftLogit - max);
    const right = Math.exp(rightLogit - max);
    const z = left + right || 1;
    return { left: left / z, right: right / z, both: 0 };
  }
  const bothLogit = -k * Math.abs(axis);
  const max = Math.max(leftLogit, rightLogit, bothLogit);
  const left = Math.exp(leftLogit - max);
  const right = Math.exp(rightLogit - max);
  const both = Math.exp(bothLogit - max);
  const z = left + right + both || 1;
  return { left: left / z, right: right / z, both: both / z };
}

/**
 * @param {{left: number, right: number, both: number}} probs
 * @param {import("./cards.js").CrestCard} row
 * @param {1|0|-1} value
 */
function pickProb(probs, row, value) {
  if (value === 0) return allowsBoth(row) ? probs.both : 1e-9;
  if (value === row.leftValue) return probs.left;
  return probs.right;
}

/** @type {Map<string, number>} */
const MEAN_CACHE = new Map();

/**
 * Mean probability of this swipe across clubs that have evidence on the facet.
 * Used when the club itself is missing that facet.
 *
 * @param {import("./cards.js").CrestCard} row
 * @param {1|0|-1} value
 * @param {number} alpha
 */
function meanSwipeProbability(row, value, alpha) {
  const key = `${row.id}:${value}:${alpha}:${SCORING_MODE}`;
  const cached = MEAN_CACHE.get(key);
  if (cached != null) return cached;
  const evidenced = [];
  for (const club of CLUBS) {
    const axis = axisValue(club, row.facet, alpha);
    if (axis == null) continue;
    evidenced.push(pickProb(choiceProbsFromAxis(axis, row, choiceSteep(club)), row, value));
  }
  const mean = evidenced.length
    ? evidenced.reduce((sum, p) => sum + p, 0) / evidenced.length
    : allowsBoth(row)
      ? 1 / 3
      : 1 / 2;
  MEAN_CACHE.set(key, mean);
  return mean;
}

/**
 * @param {CrestClub} club
 * @param {import("./cards.js").CrestCard} row
 * @param {1|0|-1} value
 * @param {number} alpha
 */
function answerProbability(club, row, value, alpha) {
  const axis = axisValue(club, row.facet, alpha);
  if (axis == null) return meanSwipeProbability(row, value, alpha);
  return pickProb(choiceProbsFromAxis(axis, row, choiceSteep(club)), row, value);
}

/**
 * @param {CrestClub} club
 * @param {CrestAnswer[]} answers
 * @param {number} alpha
 * @param {string|null} stakeId
 * @returns {{card: import("./cards.js").CrestCard, value: 1|0|-1, term: number}[]}
 */
export function cardTerms(club, answers, alpha, stakeId) {
  const terms = [];
  for (const answer of answers) {
    const row = CARDS.find((c) => c.id === answer.cardId);
    if (!row) continue;
    const p = answerProbability(club, row, answer.value, alpha);
    terms.push({
      card: row,
      value: answer.value,
      term: cardWeight(row, stakeId) * Math.log(Math.max(p, 1e-9)),
    });
  }
  return terms;
}

/**
 * Scope filter only. No Life gate, no opposite-side cuts.
 *
 * @param {CrestOptions} [options]
 * @returns {CrestClub[]}
 */
function pool(options = {}) {
  let clubs = options.clubs || CLUBS;
  if (options.group) clubs = clubs.filter((club) => club.region === options.group);
  if (options.colour) {
    clubs = clubs.filter((club) => {
      const families = club.families || club.colourFamilies || [];
      return families.includes(options.colour);
    });
  }
  if (options.competition) {
    clubs = clubs.filter((club) => (club.division || club.league || club.competition) === options.competition);
  }
  return clubs;
}

/**
 * Every club still in scope. Kept for older callers. It does not cut.
 *
 * @param {CrestAnswer[]} [_answers]
 * @param {number} [_alpha]
 * @param {CrestOptions} [options]
 * @returns {CrestClub[]}
 */
export function playPool(_answers, _alpha = DEFAULT_ALPHA, options = {}) {
  return pool(options);
}

/**
 * One ranking. Most likely first. Ties break by distinctiveness, then name, then slug.
 *
 * `score` is the geometric-mean per-weight agreement, 0 to 1. `probability`
 * is the softmax over this same list.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @returns {CrestRank[]}
 */
export function rankClubs(answers, _alpha = DEFAULT_ALPHA, options = {}) {
  let clubs = pool(options);
  const stakeId = options.stake || null;
  if (isStake(stakeId)) {
    const allowed = new Set(clubsForStake(stakeId).map((club) => club.slug));
    clubs = clubs.filter((club) => allowed.has(club.slug));
  }

  const rows = clubs.map((club) => {
    const score = suitOf(club, answers);
    return { club, logLikelihood: score, score, probability: score };
  });

  return rows.sort((a, b) => compareSuit(a, b, answers));
}

/**
 * @param {CrestRank} a
 * @param {CrestRank} b
 */
/**
 * @param {CrestRank} a
 * @param {CrestRank} b
 * @param {CrestAnswer[]} answers
 */
function compareSuit(a, b, answers) {
  if (Math.abs(a.score - b.score) >= 1e-9) return b.score - a.score;
  const gap = strongestSuit(b.club, answers) - strongestSuit(a.club, answers);
  if (Math.abs(gap) >= 1e-9) return gap;
  const byName = a.club.name.localeCompare(b.club.name);
  if (byName) return byName;
  return a.club.slug.localeCompare(b.club.slug);
}

/**
 * Fixed deck order. The stake does not reorder cards.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [_alpha]
 * @param {CrestOptions} [_options]
 * @returns {{card: import("./cards.js").CrestCard, reason: string}|null}
 */
export function nextCard(answers, _alpha = DEFAULT_ALPHA, options = {}) {
  const deck = deckFor(options.stake);
  if (options.stake && !isStake(options.stake)) return null;
  const used = new Set(answers.map((a) => a.cardId));
  const row = deck.find((card) => !used.has(card.id));
  if (!row) return null;
  return { card: row, reason: "Cards follow the deck." };
}

/**
 * The two answers where the hero's weighted log-likelihood beat the
 * runner-up by the most. Ties break by card id.
 *
 * @param {CrestClub} hero
 * @param {CrestClub|null|undefined} runner
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {string|null} [stakeId=null]
 */
export function decidingCards(hero, runner, answers, _alpha = DEFAULT_ALPHA, _stakeId = null) {
  if (!hero || !runner) return [];
  const gaps = [];
  for (const answer of answers) {
    const row = findCard(answer.cardId);
    if (!row) continue;
    const heroSuit = traitSuit(hero, row, answer.value);
    const runnerSuit = traitSuit(runner, row, answer.value);
    if (heroSuit == null || runnerSuit == null) continue;
    gaps.push({ card: row, value: answer.value, gap: heroSuit - runnerSuit });
  }
  return gaps.sort((a, b) => b.gap - a.gap || a.card.id - b.card.id).slice(0, 2);
}

/**
 * @param {number} facet
 * @param {number} value
 */
function phraseFor(facet, value) {
  if (value === 0) return "both";
  return FACETS[facet].phrases[value < 0 ? 0 : 1];
}

/**
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 */
export function arrivalSummary(answers, alpha = DEFAULT_ALPHA, options = {}) {
  const ranked = rankClubs(answers, alpha, options);
  const [top, second] = ranked;
  if (!top) {
    return {
      club: CLUBS[0],
      score: 0.5,
      probability: 0,
      confident: false,
      runnerUp: null,
      runnerUpRank: null,
      greenFlags: [],
      rub: null,
      deciding: [],
      ranked: [],
    };
  }
  const user = userVector(answers, options.stake);
  const byFacet = [];
  const seen = new Set();
  for (const answer of answers) {
    const row = CARDS.find((c) => c.id === answer.cardId);
    if (!row || seen.has(row.facet)) continue;
    seen.add(row.facet);
    const them = blend(top.club, row.facet, alpha);
    byFacet.push({
      card: row,
      value: answer.value,
      gap: them == null ? Number.POSITIVE_INFINITY : Math.abs(user.v[row.facet] - them),
      facet: row.facet,
    });
  }
  const byGap = [...byFacet].sort((a, b) => a.gap - b.gap || a.facet - b.facet);

  const flag = (t) => {
    const them = blend(top.club, t.card.facet, alpha);
    return {
      facet: FACETS[t.card.facet],
      card: t.card,
      userPhrase: phraseFor(t.card.facet, t.value),
      clubPhrase: them == null ? "no evidence" : phraseFor(t.card.facet, them),
    };
  };

  return {
    club: top.club,
    score: top.score,
    probability: top.probability,
    confident: !second || top.score - second.score >= 0.03,
    runnerUp: second ? second.club : null,
    runnerUpRank: second || null,
    greenFlags: byGap.slice(0, 2).map(flag),
    rub: byGap.length ? flag(byGap[byGap.length - 1]) : null,
    deciding: decidingCards(top.club, second ? second.club : null, answers, alpha, options.stake || null),
    ranked,
  };
}

/**
 * Colour rows are a filter of the one scope ranking, in family display order.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @param {number} [perFamily=5]
 */
export function colourMap(answers, alpha = DEFAULT_ALPHA, options = {}, perFamily = 5) {
  const ranked = rankClubs(answers, alpha, { ...options, colour: null });
  const rows = [];
  for (const family of COLOUR_FAMILIES) {
    const clubs = ranked
      .filter((row) => {
        const families = row.club.families || row.club.colourFamilies || [];
        return families.includes(family);
      })
      .slice(0, perFamily);
    if (!clubs.length) continue;
    rows.push({ family, clubs });
  }
  return rows;
}

/**
 * League rows are a filter of the one scope ranking, in competition display order.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @param {number} [perCompetition=5]
 */
export function leagueMap(answers, alpha = DEFAULT_ALPHA, options = {}, perCompetition = 5) {
  const ranked = rankClubs(answers, alpha, { ...options, colour: null, competition: null });
  const rows = [];
  for (const competition of CREST_COMPETITIONS) {
    const clubs = ranked
      .filter((row) => (row.club.division || row.club.league || row.club.competition) === competition)
      .slice(0, perCompetition);
    if (!clubs.length) continue;
    rows.push({
      competition,
      label: CREST_COMPETITION_LABEL[competition] || competition,
      clubs,
    });
  }
  return rows;
}

/**
 * @param {CrestRank[]} ranked
 * @param {number} [gap=0.4]
 * @returns {CrestClub[]}
 */
export function cluster(ranked, gap = 0.4) {
  if (!ranked.length) return [];
  const top = ranked[0].logLikelihood;
  return ranked.filter((r) => top - r.logLikelihood <= gap).map((r) => r.club);
}
