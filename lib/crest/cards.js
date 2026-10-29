/**
 * Five want decks. Eight cards each, one trait each.
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
 * @param {string} deck
 * @param {string} q
 * @param {string} s
 * @param {string} L
 * @param {string} R
 * @param {number} facet
 * @param {1|-1} leftValue
 * @param {boolean} both
 * @returns {CrestCard}
 */
function card(id, deck, q, s, L, R, facet, leftValue, both) {
  return {
    id,
    deck,
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

/**
 * Ten cards. Three on the footballer, three on the manager, two on the chairman,
 * two on belonging to the people who make the club. Same poles in every deck.
 * The sentence changes with the want. The trait does not.
 *
 * @param {string} deck
 * @param {number} id
 * @param {[string, string, string, string, number, 1|-1, boolean]} row
 */
function person(deck, id, row) {
  const [q, s, L, R, facet, leftValue, both] = row;
  return card(id, deck, q, s, L, R, facet, leftValue, both);
}

/** @type {[string, string, string, string, number, 1|-1, boolean][]} */
const BELONGING_PEOPLE = [
  ["The footballer you belong with. One who stays calm, or one who plays on the edge?", "His temperament, the way he is when the game is hard.", "A calm one", "On the edge", 1, -1, true],
  ["The footballer you belong with. One who plays from the heart, or one who plays from the head?", "What drives him when he has to choose.", "From the heart", "From the head", 7, 1, true],
  ["The footballer you belong with. One you love for how he plays, or one you love for what he wins?", "The character of his game.", "How he plays", "What he wins", 4, -1, true],
  ["The manager you belong with. A careful plan, or a risk?", "His mindset when the season is in the balance.", "A careful plan", "A risk", 5, -1, false],
  ["The manager you belong with. Someone who stays for the life of the club, or someone who comes for a title?", "Whether he is there for the years, or for the prize.", "For the life", "For a title", 0, 1, true],
  ["The manager you belong with. Someone who stands for something, or someone who only wants the win?", "His character when winning and principle pull apart.", "Stands for something", "Only the win", 11, -1, false],
  ["The chairman you belong with. One of your people, or one who arrives with the money?", "Whose hands the club is in.", "One of ours", "The money", 10, -1, false],
  ["The chairman you belong with. Someone who keeps what you have, or someone who builds something new?", "Whether he guards the old club or replaces it.", "Keeps what we have", "Builds something new", 9, -1, false],
  ["Who do you belong with? The people who make this club, or anyone who turns up?", "The players, the manager, the chairman, and the people around them.", "The people who make it", "Anyone", 2, -1, true],
  ["What do you belong to? Those people, or the prize?", "The heart of it is the members, not the trophy.", "Those people", "The prize", 3, -1, true],
];

/** @type {[string, string, string, string, number, 1|-1, boolean][]} */
const LOVE_PEOPLE = [
  ["The footballer you love. One who stays calm, or one who plays on the edge?", "The temperament you can love for a whole season.", "A calm one", "On the edge", 1, -1, true],
  ["The footballer you love. One who plays from the heart, or one who plays from the head?", "What you love in him when he has to choose.", "From the heart", "From the head", 7, 1, true],
  ["Do you love a footballer for how he plays, or for what he wins?", "The character of the player you came for.", "How he plays", "What he wins", 4, -1, true],
  ["The manager you love. A careful plan, or a risk?", "The mindset you can stay with.", "A careful plan", "A risk", 5, -1, false],
  ["The manager you love. Someone who stays for the life of the club, or someone who comes for a title?", "A man for the years, or a man for the prize.", "For the life", "For a title", 0, 1, true],
  ["The manager you love. Someone who stands for something, or someone who only wants the win?", "His character when the two pull apart.", "Stands for something", "Only the win", 11, -1, false],
  ["The chairman you could love. One of your people, or one who arrives with the money?", "Whether he feels like one of the club.", "One of ours", "The money", 10, -1, false],
  ["The chairman you could love. Someone who keeps what you have, or someone who builds something new?", "Whether he loves the club you already have.", "Keeps what we have", "Builds something new", 9, -1, false],
  ["Do you love the people who make this club, or anyone who turns up?", "The player, the manager, the chairman, the people in the room.", "The people who make it", "Anyone", 2, -1, true],
  ["Do you love those people, or the prize?", "The heart of it is who you share it with.", "Those people", "The prize", 3, -1, true],
];

/** @type {[string, string, string, string, number, 1|-1, boolean][]} */
const WINNING_PEOPLE = [
  ["In a winning side, a footballer who stays calm, or one who plays on the edge?", "The temperament you want when the game is there to be won.", "A calm one", "On the edge", 1, -1, true],
  ["In a winning side, a footballer who plays from the heart, or one who plays from the head?", "The mindset you trust when he has to choose.", "From the heart", "From the head", 7, 1, true],
  ["A footballer who wins because of how he plays, or a footballer who just wins?", "What you actually like in him.", "How he plays", "What he wins", 4, -1, true],
  ["The manager who wins for you. A careful plan, or a risk?", "His mindset when the title is in reach.", "A careful plan", "A risk", 5, -1, false],
  ["The manager who wins for you. For the life of the club, or for a title?", "Whether winning is a life, or a season.", "For the life", "For a title", 0, 1, true],
  ["The manager who wins for you. Someone who stands for something, or someone who only wants the win?", "His character when principle costs a result.", "Stands for something", "Only the win", 11, -1, false],
  ["The chairman behind a winning club. One of yours, or the money?", "Who is allowed to buy the wins.", "One of ours", "The money", 10, -1, false],
  ["The chairman behind a winning club. Someone who keeps what you have, or someone who builds something new?", "Whether the win keeps the club, or replaces it.", "Keeps what we have", "Builds something new", 9, -1, false],
  ["A winning club made of your people, or anyone who can win?", "The player, the manager, the chairman. Yours, or whoever gets it done.", "The people who make it", "Anyone", 2, -1, true],
  ["Those people, or the prize?", "Whether the win is for them, or the win is the point.", "Those people", "The prize", 3, -1, true],
];

/** @type {[string, string, string, string, number, 1|-1, boolean][]} */
const BELONGING_LOVE_PEOPLE = [
  ["The footballer you belong with and love. One who stays calm, or one who plays on the edge?", "The temperament of someone you can love as one of yours.", "A calm one", "On the edge", 1, -1, true],
  ["The footballer you belong with and love. From the heart, or from the head?", "The mindset you stay with.", "From the heart", "From the head", 7, 1, true],
  ["Do you love him for how he plays, or for what he wins?", "What the bond is actually about.", "How he plays", "What he wins", 4, -1, true],
  ["The manager you belong with and love. A careful plan, or a risk?", "His mindset, and whether you can love it.", "A careful plan", "A risk", 5, -1, false],
  ["The manager you belong with and love. For the life of the club, or for a title?", "A man you keep, or a man who comes for the prize.", "For the life", "For a title", 0, 1, true],
  ["The manager you belong with and love. Someone who stands for something, or someone who only wants the win?", "His character, and whether it is yours.", "Stands for something", "Only the win", 11, -1, false],
  ["The chairman you belong with and could love. One of yours, or the money?", "Whether he is one of the people, or the money above them.", "One of ours", "The money", 10, -1, false],
  ["The chairman you belong with and could love. Someone who keeps what you have, or someone who builds something new?", "Whether he loves the club the people already made.", "Keeps what we have", "Builds something new", 9, -1, false],
  ["The people who make this club, or anyone who turns up?", "Player, manager, chairman. The members you belong with.", "The people who make it", "Anyone", 2, -1, true],
  ["Those people, or the prize?", "The heart of belonging is who it is for.", "Those people", "The prize", 3, -1, true],
];

/** @type {[string, string, string, string, number, 1|-1, boolean][]} */
const LOVE_WINNING_PEOPLE = [
  ["The footballer you love in a winning side. Calm, or on the edge?", "The temperament you want when both love and the win are in the room.", "A calm one", "On the edge", 1, -1, true],
  ["The footballer you love in a winning side. From the heart, or from the head?", "The mindset you trust him with.", "From the heart", "From the head", 7, 1, true],
  ["Do you love him for how he plays, or because he wins?", "What you like about the footballer when the result also matters.", "How he plays", "What he wins", 4, -1, true],
  ["The manager you love who also wins. A careful plan, or a risk?", "His mindset on the nights that count.", "A careful plan", "A risk", 5, -1, false],
  ["The manager you love who also wins. For the life of the club, or for a title?", "The years, or the prize.", "For the life", "For a title", 0, 1, true],
  ["The manager you love who also wins. Someone who stands for something, or someone who only wants the win?", "His character when love and the table disagree.", "Stands for something", "Only the win", 11, -1, false],
  ["The chairman of a club you love and want to win. One of yours, or the money?", "Who is allowed to chase the win.", "One of ours", "The money", 10, -1, false],
  ["The chairman of a club you love and want to win. Someone who keeps what you have, or someone who builds something new?", "Whether the win is allowed to change the club.", "Keeps what we have", "Builds something new", 9, -1, false],
  ["Your people, or anyone who can win?", "The members you love, or whoever gets the result.", "The people who make it", "Anyone", 2, -1, true],
  ["Those people, or the prize?", "Whether the win is for them.", "Those people", "The prize", 3, -1, true],
];

/** @type {Record<string, CrestCard[]>} */
export const DECKS = {
  belonging: BELONGING_PEOPLE.map((row, index) => person("belonging", index + 1, row)),
  love: LOVE_PEOPLE.map((row, index) => person("love", index + 11, row)),
  winning: WINNING_PEOPLE.map((row, index) => person("winning", index + 21, row)),
  belonging_love: BELONGING_LOVE_PEOPLE.map((row, index) => person("belonging_love", index + 31, row)),
  love_winning: LOVE_WINNING_PEOPLE.map((row, index) => person("love_winning", index + 41, row)),
};

/** Every card, for lookup by id. A run uses one deck. */
export const CARDS = Object.values(DECKS).flat();

const BY_ID = new Map(CARDS.map((row) => [row.id, row]));

/** Cards in one run. Three players, three managers, two chairmen, two on the people. */
export const TOTAL = 10;

/** Cards that are a decision. Left or right only. */
export const BINARY_CARD_IDS = CARDS.filter((row) => row.both === false).map((row) => row.id);

/**
 * @param {string|null|undefined} stakeId
 * @returns {CrestCard[]}
 */
export function deckFor(stakeId) {
  if (stakeId && DECKS[stakeId]) return DECKS[stakeId];
  return DECKS.belonging;
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

/** Part weights. The suit score does not use them. */
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

/**
 * How many cards in the full file read this facet.
 *
 * @param {number} facet
 */
export function facetCardCount(facet) {
  let n = 0;
  for (const row of CARDS) if (row.facet === facet) n += 1;
  return n;
}
