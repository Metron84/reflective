/**
 * Crest swipe cards, deck v3.
 *
 * Eighteen cards in three parts. Part 1 is life, weight 0.7. Default order is
 * 1 to 5. A first-chip stake can reorder Life and reweight every card.
 * Part 2 is likes and dislikes, weight 0.75. Part 3 is football situations,
 * weight 1. Parts 2 and 3 are chosen adaptively by the engine.
 *
 * Each card reads one existing facet. `leftLabel` is the left swipe.
 * `leftValue` is that swipe's pole (-1 left facet pole, +1 right facet pole).
 * `context` sits on the card under the question.
 * `allowBoth` is false on situation cards that are one door.
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
export const BINARY_CARD_IDS = [13, 15, 17, 19, 20];

/** @type {CrestCard[]} */
export const CARDS = [
  // Part 1: life. Fun=Heart, Work=Head. Moments=Winning, Surviving=Enduring.
  // People=Open, Quiet=Tight-knit. Home=Rooted, Road=Global.
  // Memory=Tradition, Tomorrow=Modern.
  card(1, 1, "Living is about fun, or work?", "Fun", "Work", 7, 1, "This one is you. The club comes after."),
  card(2, 1, "Living is about moments, or surviving?", "Moments", "Surviving", 0, -1, "This one is you. The club comes after."),
  card(3, 1, "Living is about people, or quiet?", "People", "Quiet", 2, 1, "This one is you. The club comes after."),
  card(4, 1, "Living is about home, or the road?", "Home", "The road", 8, -1, "This one is you. The club comes after."),
  card(5, 1, "Living is about memory, or tomorrow?", "Memory", "Tomorrow", 9, -1, "This one is you. The club comes after."),

  // Part 2: likes and dislikes
  card(
    8,
    2,
    "A 4-3, or a 1-0 grind?",
    "4-3",
    "1-0 grind",
    4,
    -1,
    "The night you want. Chaos and goals, or a tight win.",
  ),
  card(
    9,
    2,
    "Regulars' bar, or the place anyone walks into?",
    "Regulars' bar",
    "Anyone's place",
    2,
    -1,
    "Your people. A closed room, or a door that never shuts.",
  ),
  card(
    10,
    2,
    "Build it yourself, or buy it ready?",
    "Build it",
    "Buy it",
    6,
    -1,
    "How the squad is made. Grow it, or pay for it ready.",
  ),
  card(
    11,
    2,
    "Sunday stroll or rollercoaster?",
    "Stroll",
    "Rollercoaster",
    1,
    -1,
    "The match, not the rest of your Sunday. Quiet control, or the ride.",
  ),
  card(
    12,
    2,
    "A trip: fully planned, or no plan at all?",
    "Fully planned",
    "No plan",
    5,
    -1,
    "How the season should feel. A plan, or chaos.",
  ),
  card(
    13,
    2,
    "Owner from the stands, or from a fund?",
    "The stands",
    "A fund",
    10,
    -1,
    "Who owns the club. Faces in the ground, or a fund.",
  ),

  // Part 3: football situations
  card(
    14,
    3,
    "You win either way. With flair, or with defending?",
    "Flair",
    "Defending",
    4,
    -1,
    "You win either way. How should it look?",
  ),
  card(
    15,
    3,
    "Club's broke. Fans save it, or a billionaire does?",
    "The fans",
    "Billionaire",
    10,
    -1,
    "When the club is broke. The stands save it, or one owner does.",
  ),
  card(
    16,
    3,
    "Build the next team from the academy, or through transfers?",
    "Academy",
    "Transfers",
    6,
    -1,
    "The next team. From the youth, or from the market.",
  ),
  card(
    17,
    3,
    "Stay in the old ground, or build the new 60,000?",
    "Old ground",
    "New 60,000",
    9,
    -1,
    "Stay where you were, or move to the big new bowl.",
  ),
  card(
    18,
    3,
    "Beat your rival twice, or win a cup?",
    "Rival twice",
    "The cup",
    3,
    -1,
    "Local war, or a trophy.",
  ),
  card(
    19,
    3,
    "Five straight losses. Sack the manager, or keep faith?",
    "Sack him",
    "Keep faith",
    7,
    -1,
    "Five losses. The next day at the club.",
  ),
  card(
    20,
    3,
    "A top striker is available. He once mocked your fans. Sign him?",
    "Never",
    "Sign him",
    11,
    -1,
    "A star who mocked your fans. Principle, or the points.",
  ),
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

/** Part weights. */
export const PART_WEIGHT = { 1: 0.7, 2: 0.75, 3: 1 };

/** Part labels for the play header: "{part} of 3 · {name}". */
export const PART_LABEL = {
  1: "Life",
  2: "Likes",
  3: "Football situations",
};

/** Total cards in the deck. */
export const TOTAL = 18;

/**
 * Answer-count bounds for each part, half-open `[start, end)`.
 * 0-4 Part 1, 5-10 Part 2, 11-17 Part 3.
 */
export const PART_BOUNDS = { 1: [0, 5], 2: [5, 11], 3: [11, 18] };
