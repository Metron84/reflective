/**
 * Crest swipe cards. Twenty cards in fixed deck order.
 *
 * Part weights: life 0.7, likes 0.75, football 1.
 * `leftValue` is what a left swipe stores. A right swipe stores -leftValue.
 * Both stores 0, and only when `both` is true.
 * `s` is the one-line explanation under the question.
 */

/**
 * @typedef {Object} CrestCard
 * @property {number} id
 * @property {"life"|"likes"|"football"} part
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
 */

/** @type {CrestCard[]} */
export const CARDS = [
  card(1, "life", "When you make a big decision, do you trust your gut or the numbers?", "Think of a job offer, a move, or a big purchase.", "My gut", "The numbers", 7, 1, true),
  card(2, "life", "One perfect moment, or something that lasts?", "A night you'll never forget, or good years that keep going.", "Perfect moment", "Something that lasts", 0, -1, true),
  card(3, "life", "Do you recharge with people, or on your own?", "After a long week, what fills you back up?", "With people", "On my own", 2, 1, true),
  card(4, "life", "Is your best life close to home, or out on the road?", "Staying near your roots, or seeing the world.", "Close to home", "On the road", 8, -1, true),
  card(5, "life", "Do you look back, or look ahead?", "Which excites you more: old memories or new plans?", "Look back", "Look ahead", 9, -1, true),
  card(6, "likes", "Would you rather watch a 4-3, or a 1-0 grind?", "Goals and chaos, or control and a clean sheet.", "A 4-3", "A 1-0 grind", 4, -1, true),
  card(7, "likes", "Do you build things yourself, or buy them ready-made?", "Furniture, a business, a team: make it or buy it?", "Build it", "Buy it", 6, -1, true),
  card(8, "likes", "Your weekend: a calm stroll, or a rollercoaster?", "How much drama do you want in your life?", "Calm stroll", "Rollercoaster", 1, -1, true),
  card(9, "likes", "A trip: everything planned, or no plan at all?", "A booked itinerary, or see where the day takes you.", "All planned", "No plan", 5, -1, true),
  card(10, "likes", "Known by your whole street, or famous for a day?", "Deep local respect, or one big moment in the spotlight.", "My street", "Famous for a day", 3, -1, true),
  card(11, "football", "Ten years safe in mid-table, or one title then relegation?", "Steady survival, or one glory season and a fall.", "Safe mid-table", "Title, then down", 0, 1, false),
  card(12, "football", "Last day of the season: 3-0 up by half-time, or a 94th-minute winner?", "Calm control, or the heart-attack finish.", "3-0 at half-time", "94th-minute winner", 1, -1, true),
  card(13, "football", "Should your club sell out at home, or have fans in 50 countries?", "A local institution, or a global brand.", "Sell out at home", "Fans worldwide", 8, -1, true),
  card(14, "football", "1-0 up with ten men. Park the bus, or go for the second?", "Protect what you have, or take the risk.", "Park the bus", "Go for the second", 5, -1, false),
  card(15, "football", "You win either way. With flair, or with defending?", "Does how you win matter, or only that you win?", "With flair", "With defending", 4, -1, true),
  card(16, "football", "Your club is broke. Do the fans save it, or a billionaire?", "Fan ownership, or big money and big ambition.", "The fans", "A billionaire", 10, -1, false),
  card(17, "football", "Stay in the old ground, or move to a new 60,000 stadium?", "History and atmosphere, or size and revenue.", "Old ground", "New stadium", 9, -1, false),
  card(18, "football", "Beat your rival twice, or win a cup?", "Bragging rights at home, or silverware in the cabinet.", "Beat the rival", "Win the cup", 3, -1, true),
  card(19, "football", "Five straight losses. Sack the manager, or keep faith?", "Cold logic, or loyalty through a bad run.", "Sack him", "Keep faith", 7, -1, false),
  card(20, "football", "A top striker once mocked your fans. Do you sign him?", "Principles first, or whatever it takes to win.", "Never", "Sign him", 11, -1, false),
];

/** Cards that are a decision. Left or right only. */
export const BINARY_CARD_IDS = CARDS.filter((row) => row.both === false).map((row) => row.id);

/**
 * @param {number} id
 * @param {"life"|"likes"|"football"} part
 * @param {string} q
 * @param {string} s
 * @param {string} L
 * @param {string} R
 * @param {number} facet
 * @param {1|-1} leftValue
 * @param {boolean} both
 * @returns {CrestCard}
 */
function card(id, part, q, s, L, R, facet, leftValue, both) {
  return {
    id,
    part,
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

/**
 * @param {CrestCard|null|undefined} row
 */
export function allowsBoth(row) {
  if (!row) return false;
  if (typeof row.both === "boolean") return row.both;
  return row.allowBoth !== false;
}

/** Part weights. Life 0.7, likes 0.75, football 1. */
export const PART_WEIGHT = { life: 0.7, likes: 0.75, football: 1, 1: 0.7, 2: 0.75, 3: 1 };

/** Part labels for the play header. */
export const PART_LABEL = {
  life: "Life",
  likes: "Likes",
  football: "Football",
  1: "Life",
  2: "Likes",
  3: "Football",
};

/** 1-based part index for the "n of 3" header. */
export const PART_INDEX = { life: 1, likes: 2, football: 3, 1: 1, 2: 2, 3: 3 };

/** Total swipe cards in the deck. */
export const TOTAL = 20;

/**
 * How many cards in the deck read this facet.
 * Facets with two cards take a 0.7 weight factor on each of those cards.
 *
 * @param {number} facet
 */
export function facetCardCount(facet) {
  let n = 0;
  for (const row of CARDS) if (row.facet === facet) n += 1;
  return n;
}
