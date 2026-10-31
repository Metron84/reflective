/**
 * One deck of 36. Three different questions on each of the twelve rooms.
 * Life is the first five. Every question is one equal vote.
 * Left stores leftValue. Right stores the opposite. Both stores 0.
 */

/**
 * @typedef {Object} CrestCard
 * @property {number} id
 * @property {"football"} part
 * @property {string} q
 * @property {string} s
 * @property {string} L
 * @property {string} R
 * @property {number} facet
 * @property {1|-1} leftValue
 * @property {boolean} both
 * @property {string} question
 * @property {string} context
 * @property {string} leftLabel
 * @property {string} rightLabel
 * @property {string} left
 * @property {string} right
 * @property {boolean} allowBoth
 * @property {string} deck
 */

/**
 * @param {number} id
 * @param {string} q
 * @param {string} s
 * @param {string} L
 * @param {string} R
 * @param {number} facet
 * @param {1|-1} leftValue
 * @param {boolean} both
 * @returns {CrestCard}
 */
function card(id, q, s, L, R, facet, leftValue, both) {
  return {
    id,
    deck: "crest",
    part: "football",
    q,
    s,
    L,
    R,
    facet,
    leftValue,
    both,
    question: q,
    context: s,
    leftLabel: L,
    rightLabel: R,
    left: L,
    right: R,
    allowBoth: both,
  };
}

/** @type {CrestCard[]} */
export const PLAY = [
  card(1, "Fun, or work?", "This one is you.", "Fun", "Work", 7, 1, true),
  card(2, "Moments, or the long run?", "This one is you.", "Moments", "Surviving", 0, -1, true),
  card(3, "People, or quiet?", "This one is you.", "People", "Quiet", 2, 1, true),
  card(4, "Home, or the road?", "This one is you.", "Home", "The road", 8, -1, true),
  card(5, "Memory, or tomorrow?", "This one is you.", "Memory", "Tomorrow", 9, -1, true),

  card(6, "Quiet Sunday, or the ride?", "The match itself.", "Stroll", "Rollercoaster", 1, -1, true),
  card(7, "Whose bar is it?", "A closed room, or an open door.", "Regulars", "Anyone", 2, -1, true),
  card(8, "A 4-3, or a 1-0?", "The night you want.", "4-3", "1-0", 4, -1, true),
  card(9, "A plan, or no plan?", "How the season should feel.", "Planned", "No plan", 5, -1, true),
  card(10, "Build it, or buy it?", "How the squad is made.", "Build it", "Buy it", 6, -1, true),
  card(11, "The derby, or the final?", "The night that matters.", "The derby", "The final", 3, -1, true),
  card(12, "You lose to your rival.", "How long it sits with you.", "A few days", "Until we win", 0, 1, true),
  card(13, "Flair, or a shut-out?", "You win either way.", "Flair", "Defending", 4, -1, true),
  card(14, "Five losses in a row.", "The next day at the club.", "Sack him", "Keep faith", 7, -1, false),
  card(15, "The away end.", "Who fills it.", "Our songs", "New faces", 8, -1, true),
  card(16, "The ground.", "Stay, or move.", "Old ground", "New ground", 9, -1, false),
  card(17, "Who owns it?", "Faces in the ground, or a fund.", "The stands", "A fund", 10, -1, false),
  card(18, "He mocked your fans.", "Principle, or the points.", "Never", "Sign him", 11, -1, false),

  card(19, "You lose.", "What you do with it.", "Go quiet", "Feel it all night", 1, -1, true),
  card(20, "He joins your rival.", "How long he stays dead to you.", "Never", "In time", 2, -1, true),
  card(21, "You're ahead.", "Ten minutes left.", "Hold it", "Chase another", 5, -1, true),
  card(22, "The next team.", "Where it comes from.", "Academy", "Transfers", 6, -1, true),
  card(23, "The rival, or the cup?", "Local war, or a trophy.", "Rival twice", "The cup", 3, -1, true),
  card(24, "A season with no trophy.", "What you do next.", "You stay", "You look", 0, 1, true),
  card(25, "It was an ugly win.", "What you wanted from it.", "The performance", "The result", 4, -1, true),
  card(26, "He's loved, and he's losing.", "The manager the ground sings for.", "End it", "Wait", 7, -1, true),
  card(27, "Where you follow them.", "Home, or wherever they play.", "My city", "Wherever", 8, -1, true),
  card(28, "A new badge and kit.", "The shirt in the shop.", "The old one", "The new one", 9, -1, true),
  card(29, "The club is broke.", "Who saves it.", "The fans", "A billionaire", 10, -1, false),
  card(30, "The sponsor fans hate.", "The name on the shirt.", "Refuse it", "Take it", 11, -1, true),

  card(31, "You beat your rival.", "When the banter starts.", "Next day", "Straight away", 1, -1, true),
  card(32, "You win a cup.", "How often you bring it up.", "When asked", "Any chance", 3, -1, true),
  card(33, "A final.", "How you play it.", "Play it safe", "Go for it", 5, -1, true),
  card(34, "He's one of your own.", "He's short of the level.", "Keep him", "Replace him", 6, -1, true),
  card(35, "A rich owner arrives.", "The money, or the club.", "Out", "The money", 10, -1, true),
  card(36, "The win needed a dive.", "How you want it won.", "Clean", "The points", 11, -1, true),
];

/** Every want uses the same 36. The want still chooses the club pool. */
export const DECKS = {
  belonging: PLAY,
  love: PLAY,
  winning: PLAY,
  belonging_love: PLAY,
  love_winning: PLAY,
};

/** Every card, for lookup by id. A run is the full deck. */
export const CARDS = PLAY;

const BY_ID = new Map(CARDS.map((row) => [row.id, row]));

/** Cards in one run. Three on each of the twelve rooms. */
export const TOTAL = PLAY.length;

/** Cards that are a decision. Left or right only. */
export const BINARY_CARD_IDS = CARDS.filter((row) => row.both === false).map((row) => row.id);

/**
 * @param {string|null|undefined} _stakeId
 * @returns {CrestCard[]}
 */
export function deckFor(_stakeId) {
  return PLAY;
}

/**
 * @param {number} id
 * @returns {CrestCard|null}
 */
export function findCard(id) {
  return BY_ID.get(id) || null;
}

/**
 * @param {CrestCard|null|undefined} row
 */
export function allowsBoth(row) {
  if (!row) return false;
  if (typeof row.both === "boolean") return row.both;
  return row.allowBoth !== false;
}

/** Part weights. Every question is one vote. */
export const PART_WEIGHT = { life: 1, likes: 1, football: 1, 1: 1, 2: 1, 3: 1 };

/** Part labels for the play header. */
export const PART_LABEL = {
  life: "Life",
  likes: "Likes",
  football: "Football",
  1: "Life",
  2: "Likes",
  3: "Football",
};

/** 1-based part index for the header. */
export const PART_INDEX = { life: 1, likes: 2, football: 3, 1: 1, 2: 2, 3: 3 };

/**
 * How many cards in the deck read this facet.
 *
 * @param {number} facet
 */
export function facetCardCount(facet) {
  let n = 0;
  for (const row of CARDS) if (row.facet === facet) n += 1;
  return n;
}
