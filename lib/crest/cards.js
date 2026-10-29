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

/** @type {Record<string, CrestCard[]>} */
export const DECKS = {
  belonging: [
    card(1, "belonging", "The ground. Only your people, or anyone who wants in?", "A closed room, or a door that stays open.", "Only ours", "Anyone", 2, -1, true),
    card(2, "belonging", "The club is broke. Your people save it, or someone with money?", "Who keeps the name when the money runs out.", "Our people", "Someone with money", 10, -1, false),
    card(3, "belonging", "Keep the old ground, or move to a new one?", "The place you already know, or a ground still to come.", "The old ground", "A new one", 9, -1, false),
    card(4, "belonging", "A bad season. You stay because they're yours, or you wait until it makes sense?", "Loyalty, or a reason you can explain.", "I stay", "I wait", 7, 1, true),
    card(5, "belonging", "Saturday with your people. A ground you can sit in, or one that never sits?", "A calm afternoon, or a ground that stays on its feet.", "We can sit", "It never sits", 1, -1, true),
    card(6, "belonging", "Lads from your streets, or the best you can bring in?", "The players grow up here, or they arrive from somewhere else.", "Our streets", "Bring them in", 6, -1, true),
    card(7, "belonging", "A careful season, or a risk your people will remember?", "Protect the year, or gamble it.", "Careful", "Risk it", 5, -1, false),
    card(8, "belonging", "A full ground in your city, or your people scattered everywhere?", "One place fills up, or the support travels.", "Our city", "Everywhere", 8, -1, true),
  ],
  love: [
    card(11, "love", "Do you love the way they play, or that they win?", "The football itself, or the result it produces.", "The way they play", "That they win", 4, -1, true),
    card(12, "love", "Do you love them when it is foolish?", "The feeling holds, or it has to keep making sense.", "Even then", "Not if it stops making sense", 7, 1, true),
    card(13, "love", "A love in one city, or a love you can carry anywhere?", "It lives in one place, or it travels with you.", "One city", "Anywhere", 8, -1, true),
    card(14, "love", "The old shirt, or what they are becoming?", "What they have been, or what they are turning into.", "The old shirt", "What they're becoming", 9, -1, true),
    card(15, "love", "One night you never forget, or a love that lasts years?", "A single night, or a feeling that stays.", "One night", "The years", 0, -1, true),
    card(16, "love", "Would you still love them if the money changed them?", "They stay yours, or the money is allowed to change them.", "They have to stay ours", "The money can come", 10, -1, false),
    card(17, "love", "The people in the shirt, or the prize?", "Who wears it, or what they win.", "The people", "The prize", 3, -1, true),
    card(18, "love", "A love you can trust, or one that might break your heart?", "Something steady, or something that can hurt.", "One I can trust", "Let it break my heart", 5, -1, true),
  ],
  winning: [
    card(21, "winning", "The title, or just staying up?", "The prize, or another year in the league.", "The title", "Stay up", 0, -1, false),
    card(22, "winning", "Build the squad, or buy the squad?", "Raise the players, or bring them in ready.", "Build it", "Buy it", 6, -1, false),
    card(23, "winning", "1-0 up. See it out, or go for the second?", "Protect the lead, or chase another goal.", "See it out", "Go for the second", 5, -1, false),
    card(24, "winning", "Beat the rival, or win the cup?", "The local night, or the trophy.", "The rival", "The cup", 3, -1, true),
    card(25, "winning", "Win for your city, or win so the world sees it?", "The place you play for, or the audience beyond it.", "The city", "The world", 8, -1, true),
    card(26, "winning", "3-0 at half-time, or a winner in the 94th minute?", "The game is already won, or it turns at the end.", "3-0", "The 94th minute", 1, -1, true),
    card(27, "winning", "Five losses. Sack him, or keep him?", "The table decides, or the man stays.", "Sack him", "Keep him", 7, -1, false),
    card(28, "winning", "Your own money and a harder road, or a billionaire who wins?", "The club pays its own way, or outside money buys the wins.", "Our own money", "The billionaire", 10, -1, false),
  ],
  belonging_love: [
    card(31, "belonging_love", "Only your people, or anyone who loves them too?", "The room stays closed, or love is enough to come in.", "Only ours", "Anyone who loves them", 2, -1, true),
    card(32, "belonging_love", "Your people save the club, or the money does?", "The people hold it, or the money does.", "Our people", "The money", 10, -1, false),
    card(33, "belonging_love", "The old ground, or a new one you could love?", "The place you have, or a new one you might love.", "The old ground", "A new one", 9, -1, false),
    card(34, "belonging_love", "Home, or a love you can take with you?", "It stays where you are from, or it travels.", "Home", "Take it with you", 8, -1, true),
    card(35, "belonging_love", "You stay because you love them, or because it still makes sense?", "The feeling, or a reason you can defend.", "Because I love them", "Because it makes sense", 7, 1, true),
    card(36, "belonging_love", "You love the football, or you love the result?", "How they play, or what the score says.", "The football", "The result", 4, -1, true),
    card(37, "belonging_love", "One night together, or years of it?", "A night you share, or a life of it.", "One night", "The years", 0, -1, true),
    card(38, "belonging_love", "A careful club, or a risk you take because you love them?", "Keep the season safe, or risk it for them.", "Careful", "The risk", 5, -1, true),
  ],
  love_winning: [
    card(41, "love_winning", "The title, or the years of loving them?", "The trophy, or the time you have loved them.", "The title", "The years", 0, -1, false),
    card(42, "love_winning", "Principles, or the win?", "What the club stands for, or the result.", "Principles", "The win", 11, -1, false),
    card(43, "love_winning", "Win for your city, or win in front of the world?", "The city, or the wider audience.", "The city", "The world", 8, -1, true),
    card(44, "love_winning", "The people, or the prize?", "Who they are, or what they lift.", "The people", "The prize", 3, -1, true),
    card(45, "love_winning", "A controlled win, or a winner in the 94th minute?", "The game is managed, or it turns at the end.", "Controlled", "The 94th minute", 1, -1, true),
    card(46, "love_winning", "See it out, or go for the second?", "Hold the lead, or chase another goal.", "See it out", "Go for the second", 5, -1, false),
    card(47, "love_winning", "Keep him because you love the side, or sack him because of the table?", "The feeling, or the table.", "Keep him", "Sack him", 7, 1, true),
    card(48, "love_winning", "Win beautifully, or just win?", "The way the win looks, or the win itself.", "Beautifully", "Just win", 4, -1, true),
  ],
};

/** Every card, for lookup by id. A run uses one deck. */
export const CARDS = Object.values(DECKS).flat();

const BY_ID = new Map(CARDS.map((row) => [row.id, row]));

/** Cards in one run. */
export const TOTAL = 8;

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
