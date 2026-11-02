/**
 * The Crest matcher. Ported from Metron84/the-crest lib/crest/engine.js (current main)
 * and now the only scoring module here: /crest, the saved-club pick and the league
 * reveal all import it. Scoring code below is verbatim from the-crest; do not
 * hand-edit it. Imports resolve to this repo's cards, clubs, facets, stakes and
 * competitions, which match the-crest apart from comments.
 *
 * Local changes, both marked in place: leagueMap ranks inside the play pool (see
 * rankLeague), and matchLeague and bestClubPerLeague are added at the bottom.
 */

/**
 * The Crest scoring engine. Pure functions, no React, no DOM.
 *
 * Every swipe is evidence. A club's score is the log-likelihood of the
 * person's answers. Questions are not equal: a door weighs 2, life and a
 * situation weigh 1.5, a like weighs 1.
 *
 * The club is not a 60/40 average of the two voices. Where what they say and
 * what others say agree, that agreement is the truth and it is what gets
 * scored. Where the voices are on opposite sides, or more than one step
 * apart, the facet is a fight. A fight is not evidence. It scores as a coin
 * flip, so it is not averaged into a middle and it cannot match every swipe.
 * The two voices stay visible on the report.
 *
 * Facets 0 (winning), 3 (meaning), 8 (reach) and 11 (purpose) move together
 * across the database (|r| 0.5 to 0.74). They are still scored separately:
 * folding them into one Stature axis was tested and cost six points of
 * recovery (own-club hit@5 49% to 43%), because the likelihood model does not
 * double-count correlated evidence the way a weighted mean does. The deck
 * carries the correlation instead, with 3.0 of 15 weight across the four.
 */

import { allowsBoth, CARDS, PART_BOUNDS, PART_WEIGHT, TOTAL } from "./cards.js";
import { CLUBS } from "./clubs.js";
import { FACETS } from "./facets.js";
import { lifeOrder, stakeCoeff } from "./stakes.js";
import {
  CREST_COMPETITION_LABEL,
  CREST_COMPETITIONS,
} from "./competitions.js";

/**
 * @typedef {{cardId: number, value: 1|0|-1}} CrestAnswer
 * @typedef {{v: number[], w: number[]}} CrestUserVector
 * @typedef {import("./clubs.js").CrestClub} CrestClub
 * @typedef {{club: CrestClub, score: number, probability: number, logLikelihood: number, fitPct?: number}} CrestRank
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
 * Ranking model. `likelihood` reads the club's blended facet value. `legacy`
 * is the older raw-blend steepness. Z-scores are a tiebreak only.
 * @type {'likelihood'|'legacy'}
 */
export let SCORING_MODE = "likelihood";

/**
 * @param {'likelihood'|'legacy'} mode
 */
export function setScoringMode(mode) {
  SCORING_MODE = mode === "legacy" ? "legacy" : "likelihood";
}

/**
 * Steepness of the blend likelihood. A club at 0.3 on a facet picks that
 * pole about 82 percent of the time once Both is one of the three answers.
 */
export const LIKELIHOOD_K = 3.68;

/**
 * Default scoring reads the truth, not a blend. Alpha 1 is the club's own
 * words. Alpha 0 is what others say. Any other alpha is the old numeric mix,
 * kept for a rival-eyes re-rank.
 */
export const DEFAULT_ALPHA = 0.6;

/**
 * Voices further apart than this are not the same claim. One step on the
 * club scale is 0.3, so 0.6 is two steps: still the same side of a story,
 * or one voice simply quieter.
 */
export const TRUTH_GAP = 0.6;

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
  const base = Number.isFinite(card.weight) ? card.weight : PART_WEIGHT[card.part] || 1;
  return base * stakeCoeff(stakeId, card.facet);
}

/**
 * @param {number} alpha
 */
function isTruthAlpha(alpha) {
  return Math.abs(alpha - DEFAULT_ALPHA) < 1e-9;
}

/**
 * One facet, with the two voices kept apart.
 *
 * `contested` is true when both voices have evidence and they disagree:
 * opposite signs, or a gap wider than {@link TRUTH_GAP}. `value` is the
 * agreed position. It is 0 when the facet is a fight, and that 0 must not
 * be read as a balanced club.
 *
 * @param {CrestClub} club
 * @param {number} facet
 * @returns {{
 *   value: number,
 *   contested: boolean,
 *   self: number|null,
 *   others: number|null,
 *   hasSelf: boolean,
 *   hasOthers: boolean,
 * }}
 */
export function readFacet(club, facet) {
  const hasSelf = club.selfMask ? Boolean(club.selfMask[facet]) : true;
  const hasOthers = club.othersMask ? Boolean(club.othersMask[facet]) : true;
  const self = hasSelf ? club.self[facet] : null;
  const others = hasOthers ? club.others[facet] : null;
  if (hasSelf && hasOthers) {
    const gap = Math.abs(self - others);
    const opposite =
      Math.sign(self) !== 0 && Math.sign(others) !== 0 && Math.sign(self) !== Math.sign(others);
    if (opposite || gap > TRUTH_GAP) {
      return { value: 0, contested: true, self, others, hasSelf, hasOthers };
    }
    return { value: (self + others) / 2, contested: false, self, others, hasSelf, hasOthers };
  }
  if (hasSelf) return { value: self, contested: false, self, others: null, hasSelf, hasOthers: false };
  if (hasOthers) return { value: others, contested: false, self: null, others, hasSelf: false, hasOthers };
  return { value: 0, contested: false, self: null, others: null, hasSelf: false, hasOthers: false };
}

/**
 * Position used for copy and for a single-voice view.
 * The default alpha returns the agreed truth, or null when the voices fight.
 *
 * @param {CrestClub} club
 * @param {number} facet
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @returns {number|null}
 */
export function clubAxis(club, facet, alpha = DEFAULT_ALPHA) {
  if (!isTruthAlpha(alpha)) return blend(club, facet, alpha);
  const reading = readFacet(club, facet);
  if (reading.contested) return null;
  return reading.value;
}

/**
 * Numeric mix of the two voices. Scoring at the default alpha does not use
 * this. It is the self view at 1, the others view at 0, and the rival-eyes
 * mix at {@link RIVAL_ALPHA}. Where one voice has no evidence the other is
 * used alone. Neither, 0.
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
  // Means and spreads of the live set only: Big Five top flights plus Rest of the World.
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
  const reading = readFacet(club, facet);
  if (reading.contested) return 0;
  if (reading.hasSelf && reading.hasOthers) {
    return 0.5 * zVoice(club, facet, "self") + 0.5 * zVoice(club, facet, "others");
  }
  if (reading.hasSelf) return zVoice(club, facet, "self");
  if (reading.hasOthers) return zVoice(club, facet, "others");
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

function choiceSteep(club) {
  return SCORING_MODE === "likelihood" ? LIKELIHOOD_K * confidenceOf(club) : steepness(club);
}

/**
 * @param {number} axis
 * @param {import("./cards.js").CrestCard} card
 * @param {CrestClub} club
 */
function probsFromAxis(axis, card, club) {
  const k = choiceSteep(club);
  const leftLogit = k * axis * card.leftValue;
  const rightLogit = k * axis * -card.leftValue;
  if (!allowsBoth(card)) {
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
 * Probabilities for left, right, and Both. Both is 0 on decision cards.
 * On cards that allow it, Both peaks when the club sits near 0.
 *
 * @param {CrestClub} club
 * @param {import("./cards.js").CrestCard} card
 * @param {number} alpha
 * @returns {{left: number, right: number, both: number}}
 */
function choiceProbs(club, card, alpha) {
  if (!isTruthAlpha(alpha)) return probsFromAxis(blend(club, card.facet, alpha), card, club);
  const reading = readFacet(club, card.facet);
  if (!reading.contested) return probsFromAxis(reading.value, card, club);
  const p = allowsBoth(card) ? 1 / 3 : 1 / 2;
  return { left: p, right: p, both: allowsBoth(card) ? p : 0 };
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
  if (value === 0) return allowsBoth(card) ? p.both : 1e-9;
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
    const weight = cardWeight(card, stakeId);
    terms.push({
      card,
      value: answer.value,
      weight,
      term: weight * Math.log(Math.max(p, 1e-9)),
    });
  }
  return terms;
}

function pool(options = {}) {
  let clubs = options.clubs || CLUBS;
  if (options.group) clubs = clubs.filter((club) => club.region === options.group);
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
    if (isTruthAlpha(alpha)) {
      const reading = readFacet(club, card.facet);
      if (reading.contested) {
        score += 1;
        continue;
      }
      if (Math.abs(reading.value) < LIFE_DEAD || Math.sign(reading.value) === Math.sign(answer.value)) score += 1;
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

function voiceOpposite(axis, value) {
  if (axis == null || Math.abs(axis) < LIFE_DEAD) return false;
  return Math.sign(axis) !== Math.sign(value);
}

function clearlyOpposite(club, card, value, alpha) {
  if (isTruthAlpha(alpha)) {
    const reading = readFacet(club, card.facet);
    if (reading.contested) {
      return voiceOpposite(reading.self, value) && voiceOpposite(reading.others, value);
    }
    return voiceOpposite(reading.value, value);
  }
  return voiceOpposite(blend(club, card.facet, alpha), value);
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
 * living cards are in. Colour and league maps rank the scoped set, not this list.
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
 * Log of the chance agreement: 1/3 where Both is allowed, 1/2 on a real fork.
 * Same weights as the club score, so 50 on the display scale is a coin flip.
 *
 * @param {CrestAnswer[]} answers
 * @param {string|null} stakeId
 */
function chanceLog(answers, stakeId) {
  let log = 0;
  let weight = 0;
  for (const answer of answers) {
    const card = CARDS.find((c) => c.id === answer.cardId);
    if (!card) continue;
    const w = cardWeight(card, stakeId);
    const options = allowsBoth(card) ? 3 : 2;
    log += w * Math.log(1 / options);
    weight += w;
  }
  return weight ? log / weight : Math.log(0.5);
}

/**
 * One match percent for every club. 50 is chance. 99 is every answer landing.
 * The number does not change when the club is shown inside a league or a colour.
 *
 * @param {number} score
 * @param {number} chance
 */
export function fitPercent(score, chance) {
  const s = Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
  const c = Number.isFinite(chance) && chance > 0 && chance < 1 ? chance : 1 / 3;
  const raw = s <= c ? (50 * s) / c : 50 + (50 * (s - c)) / (1 - c);
  return Math.round(Math.min(99, Math.max(1, raw)));
}

/**
 * @param {CrestRank[]} rows
 * @param {CrestAnswer[]} answers
 * @param {string|null} stakeId
 */
function stampFit(rows, answers, stakeId) {
  const chance = Math.exp(chanceLog(answers, stakeId));
  for (const row of rows) row.fitPct = fitPercent(row.score, chance);
  return rows;
}

/**
 * Rank clubs against the answers, most likely first.
 *
 * `score` is the geometric-mean per-weight agreement, 0 to 1. It does not
 * depend on which other clubs are in the set, so the same club gets the same
 * score in a league, a colour, or the full scope. `probability` is the softmax
 * of that average, not of the raw sum, so a longer deck does not hand one club
 * the whole room. `fitPct` is that score placed on one scale for every club:
 * 50 is chance, 99 is a perfect run of answers.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @returns {CrestRank[]}
 */
export function rankClubs(answers, alpha = DEFAULT_ALPHA, options = {}) {
  const clubs = pool(options);
  const stakeId = options.stake || null;

  const rows = clubs.map((club) => {
    const terms = cardTerms(club, answers, alpha, stakeId);
    const weight = terms.reduce((sum, t) => sum + t.weight, 0);
    const logLikelihood = terms.reduce((sum, t) => sum + t.term, 0);
    const avgLog = weight ? logLikelihood / weight : Math.log(0.5);
    const score = weight ? Math.exp(avgLog) : 0.5;
    return { club, logLikelihood: avgLog, score };
  });

  const logs = rows.map((row) => row.logLikelihood);
  const max = logs.reduce((m, value) => Math.max(m, value), -Infinity);
  const z = logs.reduce((sum, value) => sum + Math.exp(value - max), 0) || 1;
  rows.forEach((row, index) => {
    row.probability = Math.exp(logs[index] - max) / z;
  });

  stampFit(rows, answers, stakeId);

  return rows.sort((a, b) => {
    if (Math.abs(a.score - b.score) >= 1e-12) return b.score - a.score;
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
 * Next unused card, or null after the deck is done.
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
  const ranked = rankClubs(answers, alpha, options);
  const prior = ranked.map((r) => r.probability);
  const h0 = entropy(prior);

  let best = null;
  let bestGain = -Infinity;

  for (const card of CARDS) {
    if (card.part !== part || used.has(card.id)) continue;
    const given = ranked.map((r) => choiceProbs(r.club, card, alpha));
    const pLeft = prior.reduce((sum, p, i) => sum + p * given[i].left, 0);
    const pRight = prior.reduce((sum, p, i) => sum + p * given[i].right, 0);
    const postLeft = prior.map((p, i) => (p * given[i].left) / (pLeft || 1));
    const postRight = prior.map((p, i) => (p * given[i].right) / (pRight || 1));
    let expected = pLeft * entropy(postLeft) + pRight * entropy(postRight);
    if (allowsBoth(card)) {
      const pBoth = prior.reduce((sum, p, i) => sum + p * given[i].both, 0);
      const postBoth = prior.map((p, i) => (p * given[i].both) / (pBoth || 1));
      expected += pBoth * entropy(postBoth);
    }
    const gain = cardWeight(card, options.stake) * (h0 - expected);
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
 * `confident` is true when the leader leads the runner-up by more than four
 * match points. `greenFlags` are
 * the two answers that counted most for the club, `rub` the one that counted
 * most against it.
 *
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
      fitPct: 50,
      runnerUpFit: null,
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
    const them = clubAxis(top.club, card.facet, alpha);
    if (them == null) continue;
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
    clubPhrase: phraseFor(t.card.facet, clubAxis(top.club, t.card.facet, alpha)),
  });

  return {
    club: top.club,
    score: top.score,
    probability: top.probability,
    fitPct: top.fitPct,
    runnerUpFit: second ? second.fitPct : null,
    confident: !second || top.fitPct - second.fitPct > 4,
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
  });
}

/**
 * The colour map for the result screen: for each colour family in the scoped
 * set, the closest clubs wearing it. Ranked inside that colour only.
 * Families are ordered by the log-likelihood of their best club.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @param {number} [perFamily=5]
 * @returns {{family: string, clubs: CrestRank[]}[]}
 */
export function colourMap(answers, alpha = DEFAULT_ALPHA, options = {}, perFamily = 5) {
  const ranked = rankClubs(answers, alpha, { ...options, colour: null, competition: null });
  const rows = [];
  for (const family of COLOUR_FAMILIES) {
    const clubs = ranked.filter((row) => row.club.colourFamilies && row.club.colourFamilies.includes(family));
    if (!clubs.length) continue;
    rows.push({ family, clubs: clubs.slice(0, perFamily), bestLl: clubs[0].logLikelihood });
  }
  return rows.sort((a, b) => b.bestLl - a.bestLl).map(({ family, clubs }) => ({ family, clubs }));
}

/**
 * The league map for the result screen: for each competition in the scoped
 * set, the closest clubs in it. Ranked inside that league only.
 * Rows are ordered by the log-likelihood of their best club.
 *
 * @param {CrestAnswer[]} answers
 * @param {number} [alpha=DEFAULT_ALPHA]
 * @param {CrestOptions} [options]
 * @param {number} [perCompetition=5]
 * @returns {{competition: string, label: string, clubs: CrestRank[]}[]}
 */
export function leagueMap(answers, alpha = DEFAULT_ALPHA, options = {}, perCompetition = 5) {
  const ranked = rankClubs(answers, alpha, { ...options, colour: null, competition: null });
  const rows = [];
  for (const competition of CREST_COMPETITIONS) {
    const clubs = ranked.filter((row) => row.club.competition === competition);
    if (!clubs.length) continue;
    rows.push({
      competition,
      label: CREST_COMPETITION_LABEL[competition] || competition,
      clubs: clubs.slice(0, perCompetition),
      bestLl: clubs[0].logLikelihood,
    });
  }
  return rows
    .sort((a, b) => b.bestLl - a.bestLl)
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

/** 0 to 100, for the overall result (room_pct). League reveal rows no longer show a percentage. */
export function roomPercent(probability) {
  return Math.round(Math.max(0, Math.min(1, probability)) * 100);
}

/**
 * Every club of one competition, best first, as {club, probability}. The play pool
 * ranking comes first so it agrees with the saved club; clubs the pool dropped follow,
 * ranked on the whole league, so a rivalry exclusion always has a next best club to take.
 * `probability` is the club's strength within its league, used only to order picks.
 *
 * @param {CrestAnswer[]} answers
 * @param {string} competition
 * @param {{stake?: string|null, alpha?: number, gated: CrestClub[]}} opts
 */
function leagueCandidates(answers, competition, opts) {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const stake = opts.stake || null;
  return rankClubs(answers, alpha, { stake, colour: null, competition }).map((row) => ({
    club: row.club,
    probability: row.score,
  }));
}

/** True when a and b are rivals in the given map (two-way, so either side may list the other). */
function rivalPair(rivals, a, b) {
  return (rivals[a] ?? []).includes(b) || (rivals[b] ?? []).includes(a);
}

/**
 * Lock one club per league under the rivalry rule. Pure: no scoring, no I/O.
 *
 * The member's overall club is home and is locked first, so none of its rivals can appear
 * in any row. Then leagues are locked in order of the strength of their best pick (its
 * probability within the league, strongest first). A pick that is a rival of any club
 * already locked is skipped for that league's next best club. Home always takes its own
 * league's row. A league with no eligible club is left out.
 *
 * @param {{competition: string, label: string, candidates: {club: CrestClub, probability: number}[]}[]} leagues
 *   in display order, candidates best first
 * @param {{home?: CrestClub|null, rivals?: Record<string, string[]>}} [opts]
 * @returns {{competition: string, label: string, club: CrestClub, probability: number}[]} display order
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
    if (home && home.competition === league.competition) {
      const own = league.candidates.find((c) => c.club.slug === home.slug);
      pick = own ?? { club: home, probability: 0 };
    } else {
      pick =
        league.candidates.find((c) => !locked.some((slug) => rivalPair(rivals, c.club.slug, slug))) ?? null;
      if (pick) locked.push(pick.club.slug);
    }
    if (pick) picks.set(league.competition, { competition: league.competition, label: league.label, ...pick });
  }
  return leagues.filter((l) => picks.has(l.competition)).map((l) => picks.get(l.competition));
}

/**
 * Best club in one competition for a saved answers array, ignoring rivalries.
 *
 * @param {CrestAnswer[]} answers
 * @param {string} competition  a name from CREST_COMPETITIONS
 * @param {{stake?: string|null, scope?: string|null, alpha?: number, gated?: CrestClub[]}} [opts]
 * @returns {{club: CrestClub, probability: number}|null} null when the competition has no clubs
 */
export function matchLeague(answers, competition, opts = {}) {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const stake = opts.stake || null;
  return leagueCandidates(answers, competition, { alpha, stake })[0] ?? null;
}

/**
 * One row per competition that has clubs, in CREST_COMPETITIONS order, under the rivalry rule.
 * Rows carry the club only. There is no percentage.
 *
 * `home` is the member's overall club (a slug; defaults to the club the answers produce).
 * `rivals` is the rivalry map ({ slug: [slugs] }); without it no rival is excluded.
 *
 * @param {CrestAnswer[]} answers
 * @param {{stake?: string|null, scope?: string|null, alpha?: number, home?: string|null, rivals?: Record<string, string[]>}} [opts]
 * @returns {{competition: string, label: string, club: CrestClub}[]}
 */
export function bestClubPerLeague(answers, opts = {}) {
  const alpha = opts.alpha ?? DEFAULT_ALPHA;
  const stake = opts.stake || null;

  const leagues = [];
  for (const competition of CREST_COMPETITIONS) {
    const candidates = leagueCandidates(answers, competition, { alpha, stake });
    if (!candidates.length) continue;
    leagues.push({ competition, label: CREST_COMPETITION_LABEL[competition] || competition, candidates });
  }

  const home =
    (opts.home && CLUBS.find((c) => c.slug === opts.home)) ||
    arrivalSummary(answers, alpha, { group: opts.scope || null, stake }).club;

  return lockLeaguePicks(leagues, { home, rivals: opts.rivals }).map(({ competition, label, club }) => ({
    competition,
    label,
    club,
  }));
}
