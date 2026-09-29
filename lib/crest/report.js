/**
 * Crest result report. Pure functions, no React, no DOM.
 *
 * Ranking stays in engine.js. This file only names why the top club won
 * and where the person parts from it. Shared and The rub come from the
 * existing likelihood flags, not from a second distance model.
 */

import { CARDS, PART_WEIGHT } from "./cards.js";
import {
  DEFAULT_ALPHA,
  arrivalSummary,
  blend,
  leagueMap,
  playPool,
  rankClubs,
  userVector,
} from "./engine.js";
import { FACETS } from "./facets.js";
import { stakeLine } from "./stakes.js";

/**
 * @typedef {'blend'|'self'|'others'} CrestReportView
 * @typedef {{answers: import("./engine.js").CrestAnswer[], group?: string|null, colour?: string|null, stake?: string|null}} CrestResult
 */

/**
 * Meet / split / trait copy for each facet index. Pole labels and Heart /
 * Mind / Soul groups stay on FACETS so the tracks match the result screen.
 */
export const REPORT_PHRASES = [
  {
    id: "winning",
    topic: "winning",
    leftMeet: "wanting to win",
    rightMeet: "sticking with it through anything",
    split: "what a season is for",
    leftTrait: "win-first",
    rightTrait: "in it for the long haul",
  },
  {
    id: "climate",
    topic: "intensity",
    leftMeet: "keeping calm",
    rightMeet: "feeling every kick",
    split: "how hot the stands should run",
    leftTrait: "calm",
    rightTrait: "intense",
  },
  {
    id: "openness",
    topic: "openness",
    leftMeet: "a close circle",
    rightMeet: "an open door",
    split: "who gets let in",
    leftTrait: "a close circle",
    rightTrait: "an open house",
  },
  {
    id: "meaning",
    topic: "meaning",
    leftMeet: "belonging",
    rightMeet: "chasing glory",
    split: "what makes it worth it",
    leftTrait: "about belonging",
    rightTrait: "about glory",
  },
  {
    id: "style",
    topic: "style",
    leftMeet: "how the game should look",
    rightMeet: "results",
    split: "how football should be played",
    leftTrait: "about the beautiful game",
    rightTrait: "about results",
  },
  {
    id: "risk",
    topic: "risk",
    leftMeet: "having a plan",
    rightMeet: "taking the gamble",
    split: "how much to risk",
    leftTrait: "a planner",
    rightTrait: "a gambler",
  },
  {
    id: "talent",
    topic: "talent",
    leftMeet: "growing your own",
    rightMeet: "buying the best",
    split: "how a squad is built",
    leftTrait: "homegrown at heart",
    rightTrait: "happy to buy the best",
  },
  {
    id: "philosophy",
    topic: "head vs heart",
    leftMeet: "thinking it through",
    rightMeet: "following the heart",
    split: "how a club should think",
    leftTrait: "head first",
    rightTrait: "heart first",
  },
  {
    id: "reach",
    topic: "reach",
    leftMeet: "staying rooted",
    rightMeet: "a global reach",
    split: "how far a club should reach",
    leftTrait: "rooted",
    rightTrait: "global",
  },
  {
    id: "time",
    topic: "tradition",
    leftMeet: "tradition",
    rightMeet: "the new",
    split: "old ways and new",
    leftTrait: "traditional",
    rightTrait: "modern",
  },
  {
    id: "power",
    topic: "ownership",
    leftMeet: "local ownership",
    rightMeet: "big money behind the club",
    split: "who should own a club",
    leftTrait: "for local ownership",
    rightTrait: "at ease with big money",
  },
  {
    id: "purpose",
    topic: "purpose",
    leftMeet: "standing for something",
    rightMeet: "winning above all",
    split: "what a club is for",
    leftTrait: "about standing for something",
    rightTrait: "about winning",
  },
];

const VIEW_ALPHA = {
  blend: DEFAULT_ALPHA,
  self: 1,
  others: 0,
};

const RUB_GAP = 0.8;
const MEET_GAP = 0.35;
const NEAR_GAP = 0.7;
const CLOSER_DELTA = -0.1;

/**
 * Display percent from an engine score. 50 is coin-flip, 100 is a perfect match.
 *
 * @param {number} score
 */
export function matchPercent(score) {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

/**
 * Display percent from a club's share of the last room.
 *
 * @param {number} probability
 */
export function roomPercent(probability) {
  return Math.round(Math.max(0, Math.min(1, probability)) * 100);
}

/**
 * Clubs to show on a colour or league expand. Hide shares that round to 0%.
 *
 * @param {import("./engine.js").CrestRank[]} clubs
 */
export function visibleRoomClubs(clubs) {
  return clubs.filter((entry) => roomPercent(entry.probability) > 0);
}

/**
 * @param {number} v
 * @returns {'left'|'right'|'balanced'}
 */
export function pole(v) {
  if (v <= -0.2) return "left";
  if (v >= 0.2) return "right";
  return "balanced";
}

/**
 * @param {typeof REPORT_PHRASES[number]} phrase
 * @param {number} user
 * @param {number} club
 */
export function meetPhrase(phrase, user, club) {
  const userPole = pole(user);
  const clubPole = pole(club);
  if (userPole === "balanced" && clubPole === "balanced") {
    return `a balance on ${phrase.topic}`;
  }
  const side = userPole === "balanced" ? clubPole : userPole;
  if (side === "left") return phrase.leftMeet;
  if (side === "right") return phrase.rightMeet;
  return `a balance on ${phrase.topic}`;
}

/**
 * @param {typeof REPORT_PHRASES[number]} phrase
 * @param {number} value
 */
export function trait(phrase, value) {
  const side = pole(value);
  if (side === "left") return phrase.leftTrait;
  if (side === "right") return phrase.rightTrait;
  return `balanced on ${phrase.topic}`;
}

/**
 * Highest-weight card answered on this facet, Part 3 over 2 over 1.
 *
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {number} facet
 */
function swipeLine(answers, facet) {
  let best = null;
  for (const answer of answers) {
    const card = CARDS.find((c) => c.id === answer.cardId);
    if (!card || card.facet !== facet) continue;
    const weight = PART_WEIGHT[card.part];
    if (
      !best ||
      weight > best.weight ||
      (weight === best.weight && card.part > best.card.part)
    ) {
      best = { card, value: answer.value, weight };
    }
  }
  if (!best) return "";
  const option = best.value === 0 ? "Both" : best.value === best.card.leftValue ? best.card.left : best.card.right;
  return `You swiped: ${option}.`;
}

function shortName(club) {
  return club.shortName || club.name;
}

function facetIndex(flag) {
  return FACETS.findIndex((f) => f.key === flag.facet.key);
}

function flagsFor(club, answers, alpha, stake) {
  return arrivalSummary(answers, alpha, { clubs: [club], stake });
}

function buildOpener(sharedRows, rubRow) {
  const [first, second] = sharedRows;
  let line;
  if (first && second && first.gap <= MEET_GAP && second.gap <= MEET_GAP) {
    line = `You meet them on ${first.meet} and ${second.meet}.`;
  } else if (first && first.gap <= MEET_GAP) {
    line = `You meet them on ${first.meet}.`;
  } else if (first) {
    line = `You come closest on ${first.meet}.`;
  } else {
    line = "You come closest on how the club feels.";
  }
  if (rubRow) line += ` You split on ${rubRow.split}.`;
  return line;
}

function buildVerdict(name, rubRow, you, them) {
  if (rubRow) {
    const phrase = REPORT_PHRASES[rubRow.index];
    return `${name} is ${trait(phrase, them)}. You are ${trait(phrase, you)}. That is where you part.`;
  }
  return `No real gap. You and ${name} pull the same way.`;
}

/**
 * Why a rival sits closer or further than the top club on the raw blend.
 *
 * @param {import("./engine.js").CrestUserVector} user
 * @param {import("./clubs.js").CrestClub} topClub
 * @param {import("./clubs.js").CrestClub} rival
 * @param {number} alpha
 * @param {string} name
 */
export function closeBehindReason(user, topClub, rival, alpha, name) {
  let closer = null;
  let further = null;
  for (let i = 0; i < 12; i++) {
    if (!user.w[i]) continue;
    const delta =
      Math.abs(user.v[i] - blend(rival, i, alpha)) - Math.abs(user.v[i] - blend(topClub, i, alpha));
    const row = { topic: REPORT_PHRASES[i].topic, delta };
    if (!closer || row.delta < closer.delta) closer = row;
    if (!further || row.delta > further.delta) further = row;
  }
  if (closer && closer.delta < CLOSER_DELTA && further) {
    return `Closer than ${name} on ${closer.topic}. Further on ${further.topic}.`;
  }
  if (further) return `Further on ${further.topic}.`;
  return "";
}

/**
 * Turn a finished Crest result into the report object. `view` changes the
 * club voice and the match percent of the same top club. It does not re-rank.
 *
 * @param {CrestResult} result
 * @param {CrestReportView} [view='blend']
 */
export function buildReport(result, view = "blend") {
  const answers = result?.answers || [];
  const group = result?.group ?? null;
  const colour = result?.colour ?? null;
  const stake = result?.stake ?? null;
  if (!answers.length) return null;

  const options = { group, colour, stake };
  const ranked = rankClubs(answers, DEFAULT_ALPHA, {
    ...options,
    clubs: playPool(answers, DEFAULT_ALPHA, options),
  });
  const top = ranked[0];
  if (!top) return null;

  const alpha = VIEW_ALPHA[view] ?? DEFAULT_ALPHA;
  const matchScore =
    view === "blend" ? top.score : rankClubs(answers, alpha, { clubs: [top.club], stake })[0].score;
  const user = userVector(answers, stake);
  const viewFlags = flagsFor(top.club, answers, alpha, stake);
  const blendFlags = view === "blend" ? viewFlags : flagsFor(top.club, answers, DEFAULT_ALPHA, stake);

  const sharedKeys = new Set(viewFlags.greenFlags.map((flag) => flag.facet.key));
  const rubIndex = viewFlags.rub ? facetIndex(viewFlags.rub) : -1;
  const blendShared = blendFlags.greenFlags
    .map((flag) => {
      const i = facetIndex(flag);
      const phrase = i >= 0 ? REPORT_PHRASES[i] : null;
      if (!phrase) return null;
      const you = user.v[i];
      const them = blend(top.club, i, DEFAULT_ALPHA);
      return { i, phrase, meet: meetPhrase(phrase, you, them), gap: Math.abs(you - them) };
    })
    .filter(Boolean);
  const blendRubIndex = blendFlags.rub ? facetIndex(blendFlags.rub) : -1;
  const blendRubYou = blendRubIndex >= 0 ? user.v[blendRubIndex] : 0;
  const blendRubThem = blendRubIndex >= 0 ? blend(top.club, blendRubIndex, DEFAULT_ALPHA) : 0;
  const blendRubGap = Math.abs(blendRubYou - blendRubThem);
  const blendRub =
    blendRubIndex >= 0 && blendRubGap >= RUB_GAP
      ? { phrase: REPORT_PHRASES[blendRubIndex], split: REPORT_PHRASES[blendRubIndex].split }
      : null;

  const name = shortName(top.club);
  const facets = [];
  for (let i = 0; i < 12; i++) {
    if (!user.w[i]) continue;
    const facet = FACETS[i];
    const phrase = REPORT_PHRASES[i];
    const you = user.v[i];
    const them = blend(top.club, i, alpha);
    const gap = Math.abs(you - them);
    const isRub = i === rubIndex && gap >= RUB_GAP;
    let tag = "Apart";
    if (sharedKeys.has(facet.key)) tag = "Shared";
    else if (isRub) tag = "The rub";
    else if (gap <= NEAR_GAP) tag = "Near";

    facets.push({
      index: i,
      id: phrase.id,
      name: facet.label,
      group: facet.group,
      leftLabel: facet.left,
      rightLabel: facet.right,
      you,
      them,
      youPos: ((you + 1) / 2) * 100,
      themPos: ((them + 1) / 2) * 100,
      gap,
      tag,
      swipeLine: swipeLine(answers, i),
      meet: meetPhrase(phrase, you, them),
      split: phrase.split,
      topic: phrase.topic,
    });
  }

  const shared = facets.filter((f) => f.tag === "Shared").slice(0, 2);
  const rub = facets.find((f) => f.tag === "The rub") || null;
  const viewRubYou = rub ? user.v[rub.index] : 0;
  const viewRubThem = rub ? blend(top.club, rub.index, alpha) : 0;

  const leagueRows = leagueMap(answers, DEFAULT_ALPHA, { group, colour: null, stake });
  const leagues = leagueRows.map((row) => ({
    league: row.label,
    group: row.competition,
    clubName: row.clubs[0].club.name,
    matchPct: roomPercent(row.clubs[0].probability),
    isTop:
      row.clubs[0].club.slug === top.club.slug ||
      row.competition === top.club.competition,
  }));

  const closeBehind = ranked.slice(1, 6).map((row) => ({
    name: row.club.name,
    matchPct: roomPercent(row.probability),
    dotColor: row.club.color || "#F2EDE4",
    reason: closeBehindReason(user, top.club, row.club, DEFAULT_ALPHA, name),
  }));

  const leadPct = roomPercent(top.probability);
  const secondPct = ranked[1] ? roomPercent(ranked[1].probability) : 0;
  const clusterLine =
    ranked[1] && leadPct - secondPct <= 3
      ? `These five share almost everything you care about. ${name} edges it.`
      : null;

  return {
    club: {
      id: top.club.slug,
      name: top.club.name,
      shortName: name,
      city: top.club.city,
      country: top.club.country,
      stadium: top.club.home,
      league: top.club.group,
      selfLine: top.club.selfLine,
      othersLine: top.club.othersLine,
    },
    matchPct: matchPercent(matchScore),
    roomPct: roomPercent(top.probability),
    stakeLine: stakeLine(stake),
    facets,
    shared,
    rub,
    opener: buildOpener(blendShared, blendRub),
    voiceLine: top.club.selfLine || "",
    verdict: buildVerdict(name, rub, viewRubYou, viewRubThem),
    leagues,
    closeBehind,
    clusterLine,
  };
}
