/**
 * Crest swipe cards, deck v4.
 *
 * Thirty-six cards. Three different questions on each of the twelve rooms.
 * Life is the first five, then likes, then situations. Every question weighs 1.
 *
 * Each card reads one facet. `leftLabel` is the left swipe.
 * `leftValue` is that swipe's pole (-1 left facet pole, +1 right facet pole).
 * `context` sits under the headline. `allowBoth` is false on a real fork.
 */

/**
 * @typedef {Object} CrestCard
 * @property {number} id
 * @property {1|2|3} part
 * @property {string} question
 * @property {string} leftLabel
 * @property {string} rightLabel
 * @property {string} left
 * @property {string} right
 * @property {number} facet
 * @property {1|-1} leftValue
 * @property {boolean} allowBoth
 * @property {string} [context]
 */

/** Cards that are a decision. Left or right only. */
export const BINARY_CARD_IDS = [14, 16, 17, 18, 29];

/** @type {CrestCard[]} */
export const CARDS = [
  card(1, 1, "Fun, or work?", "Fun", "Work", 7, 1, "This one is you."),
  card(2, 1, "Moments, or the long run?", "Moments", "Surviving", 0, -1, "This one is you."),
  card(3, 1, "People, or quiet?", "People", "Quiet", 2, 1, "This one is you."),
  card(4, 1, "Home, or the road?", "Home", "The road", 8, -1, "This one is you."),
  card(5, 1, "Memory, or tomorrow?", "Memory", "Tomorrow", 9, -1, "This one is you."),

  card(6, 2, "Quiet Sunday, or the ride?", "Stroll", "Rollercoaster", 1, -1, "The match itself."),
  card(7, 2, "Whose bar is it?", "Regulars", "Anyone", 2, -1, "A closed room, or an open door."),
  card(8, 2, "A 4-3, or a 1-0?", "4-3", "1-0", 4, -1, "The night you want."),
  card(9, 2, "A plan, or no plan?", "Planned", "No plan", 5, -1, "How the season should feel."),
  card(10, 2, "Build it, or buy it?", "Build it", "Buy it", 6, -1, "How the squad is made."),
  card(11, 2, "The derby, or the final?", "The derby", "The final", 3, -1, "The night that matters."),
  card(12, 2, "You lose to your rival.", "A few days", "Until we win", 0, 1, "How long it sits with you."),
  card(13, 2, "Flair, or a shut-out?", "Flair", "Defending", 4, -1, "You win either way."),
  card(14, 2, "Five losses in a row.", "Sack him", "Keep faith", 7, -1, "The next day at the club."),
  card(15, 2, "The away end.", "Our songs", "New faces", 8, -1, "Who fills it."),
  card(16, 2, "The ground.", "Old ground", "New ground", 9, -1, "Stay, or move."),
  card(17, 2, "Who owns it?", "The stands", "A fund", 10, -1, "Faces in the ground, or a fund."),
  card(18, 2, "He mocked your fans.", "Never", "Sign him", 11, -1, "Principle, or the points."),
  card(19, 2, "You lose.", "Go quiet", "Feel it all night", 1, -1, "What you do with it."),
  card(20, 2, "He joins your rival.", "Never", "In time", 2, -1, "How long he stays dead to you."),

  card(21, 3, "You're ahead.", "Hold it", "Chase another", 5, -1, "Ten minutes left."),
  card(22, 3, "The next team.", "Academy", "Transfers", 6, -1, "Where it comes from."),
  card(23, 3, "The rival, or the cup?", "Rival twice", "The cup", 3, -1, "Local war, or a trophy."),
  card(24, 3, "A season with no trophy.", "You stay", "You look", 0, 1, "What you do next."),
  card(25, 3, "It was an ugly win.", "The performance", "The result", 4, -1, "What you wanted from it."),
  card(26, 3, "He's loved, and he's losing.", "End it", "Wait", 7, -1, "The manager the ground sings for."),
  card(27, 3, "Where you follow them.", "My city", "Wherever", 8, -1, "Home, or wherever they play."),
  card(28, 3, "A new badge and kit.", "The old one", "The new one", 9, -1, "The shirt in the shop."),
  card(29, 3, "The club is broke.", "The fans", "A billionaire", 10, -1, "Who saves it."),
  card(30, 3, "The sponsor fans hate.", "Refuse it", "Take it", 11, -1, "The name on the shirt."),
  card(31, 3, "You beat your rival.", "Next day", "Straight away", 1, -1, "When the banter starts."),
  card(32, 3, "You win a cup.", "When asked", "Any chance", 3, -1, "How often you bring it up."),
  card(33, 3, "A final.", "Play it safe", "Go for it", 5, -1, "How you play it."),
  card(34, 3, "He's one of your own.", "Keep him", "Replace him", 6, -1, "He's short of the level."),
  card(35, 3, "A rich owner arrives.", "Out", "The money", 10, -1, "The money, or the club."),
  card(36, 3, "The win needed a dive.", "Clean", "The points", 11, -1, "How you want it won."),
];

/**
 * @param {number} id
 * @param {1|2|3} part
 * @param {string} question
 * @param {string} leftLabel
 * @param {string} rightLabel
 * @param {number} facet
 * @param {1|-1} leftValue
 * @param {string} [context]
 */
function card(id, part, question, leftLabel, rightLabel, facet, leftValue, context) {
  const row = {
    id,
    part,
    question,
    leftLabel,
    rightLabel,
    left: leftLabel,
    right: rightLabel,
    facet,
    leftValue,
    allowBoth: !BINARY_CARD_IDS.includes(id),
  };
  if (context) row.context = context;
  return row;
}

/**
 * @param {CrestCard|null|undefined} card
 */
export function allowsBoth(card) {
  return Boolean(card) && card.allowBoth !== false;
}

/** Every question is one vote. */
export const PART_WEIGHT = { 1: 1, 2: 1, 3: 1 };

/** Part labels for the play header: "{part} of 3 · {name}". */
export const PART_LABEL = {
  1: "Life",
  2: "Likes",
  3: "Football situations",
};

/** Total cards in the deck. */
export const TOTAL = 36;

/**
 * Answer-count bounds for each part, half-open `[start, end)`.
 * Life is the first five. Likes follow. Situations close the deck.
 */
export const PART_BOUNDS = { 1: [0, 5], 2: [5, 20], 3: [20, 36] };
