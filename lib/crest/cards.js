/**
 * One deck of 36. Three different questions on each of the twelve rooms.
 * Life is the first five. A like weighs 1, life and a situation weigh 1.5, a door weighs 2.
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
function card(id, q, s, L, R, facet, leftValue, both, leftNote, rightNote) {
  const weight = both ? (id <= 5 || id >= 21 ? 1.5 : 1) : 2;
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
    leftNote,
    rightNote,
    weight,
    allowBoth: both,
  };
}

/** Line under Both, on every card that allows it. */
export const BOTH_NOTE = "Either. You are not picking a side.";

/** @type {CrestCard[]} */
export const PLAY = [
  card(1, "Fun, or work?", "This one is you, before the club.", "Fun", "Work", 7, 1, true, "In it for the enjoyment.", "Something you apply yourself to."),
  card(2, "Moments, or the long run?", "This one is you. What a season is for.", "Moments", "Surviving", 0, -1, true, "The high points are the point.", "Staying in it matters more."),
  card(3, "People, or quiet?", "This one is you. The room around you.", "People", "Quiet", 2, 1, true, "You want company.", "A smaller, quieter room."),
  card(4, "Home, or the road?", "This one is you. Where the club lives in your life.", "Home", "The road", 8, -1, true, "Your own place.", "Out in the world."),
  card(5, "Memory, or tomorrow?", "This one is you. Which way you face.", "Memory", "Tomorrow", 9, -1, true, "What has already been.", "What comes next."),

  card(6, "Quiet Sunday, or the ride?", "The match itself. The afternoon you want.", "Stroll", "Rollercoaster", 1, -1, true, "A calm Sunday.", "A match that swings."),
  card(7, "Whose bar is it?", "A closed room, or an open door.", "Regulars", "Anyone", 2, -1, true, "The same people, every week.", "Whoever walks in."),
  card(8, "A 4-3, or a 1-0?", "The night you want from a match.", "4-3", "1-0", 4, -1, true, "Goals, and a night that could go anywhere.", "A tight win is enough."),
  card(9, "A plan, or no plan?", "How the season should feel.", "Planned", "No plan", 5, -1, true, "You want to know the path.", "Take it as it comes."),
  card(10, "Build it, or buy it?", "How the squad is made.", "Build it", "Buy it", 6, -1, true, "Grow your own players.", "Bring in who you need."),
  card(11, "The derby, or the final?", "The night that matters more.", "The derby", "The final", 3, -1, true, "Beating the rival.", "The trophy night."),
  card(12, "You lose to your rival.", "How long that loss sits with you.", "A few days", "Until we win", 0, -1, true, "Then it fades.", "It stays until you beat them."),
  card(13, "The chance.", "You are in their box.", "One more pass", "Shoot", 4, -1, true, "Make the extra pass.", "Take the shot."),
  card(14, "Five losses in a row.", "The next day at the club.", "Sack him", "Keep faith", 7, -1, false, "The manager goes.", "You give him more time."),
  card(15, "The away end.", "Who you want filling it.", "Our songs", "New faces", 8, -1, true, "The people who know the songs.", "People new to the club."),
  card(16, "The ground.", "Stay, or move.", "Old ground", "New ground", 9, -1, false, "Stay where you are.", "Move to a new one."),
  card(17, "Who owns it?", "The people there, or outside money.", "The stands", "A fund", 10, -1, false, "The people in the ground.", "Outside money."),
  card(18, "He mocked your fans.", "Principle, or the player.", "Never", "Sign him", 11, -1, false, "You do not sign him.", "You take him anyway."),

  card(19, "Full time. You lost.", "The rest of the night.", "Switch off", "Stay in it", 1, -1, true, "Leave it there.", "The defeat stays with you."),
  card(20, "He joins your rival.", "How long until you forgive him.", "Cut off", "Not forever", 2, -1, true, "He is done to you.", "In time, you let it go."),
  card(21, "You're ahead.", "Ten minutes left. You are winning.", "Hold it", "Chase another", 5, -1, true, "See the game out.", "Go for one more goal."),
  card(22, "The window.", "The squad is short.", "One more year", "Buy now", 6, -1, true, "Wait.", "Spend in this window."),
  card(23, "The crowd, or the medal?", "The thing you came for.", "The crowd", "The medal", 3, -1, true, "The people in the ground.", "The prize."),
  card(24, "A season with no trophy.", "What you do next.", "You stay", "You look", 0, 1, true, "This is still your club.", "You start looking elsewhere."),
  card(25, "It was an ugly win.", "What you wanted from the night.", "The performance", "The result", 4, -1, true, "How the football looked.", "That you won."),
  card(26, "The anthem, or the tactic?", "What decides the night for you.", "The tactic", "The anthem", 7, -1, true, "The plan on the pitch.", "The feeling in the ground."),
  card(27, "Fans who never visit.", "They watch from another country.", "Not really", "They're ours", 8, -1, true, "They are not the same as the ground.", "A fan is a fan, wherever they watch."),
  card(28, "The old song.", "They want a new one before kickoff.", "Keep it", "Change it", 9, -1, true, "The old song stays.", "Sing the new one."),
  card(29, "The club is broke.", "Who saves it.", "The fans", "A billionaire", 10, -1, false, "The supporters keep it going.", "One rich owner saves it."),
  card(30, "The sponsor fans hate.", "The name on the shirt.", "Refuse it", "Take it", 11, -1, true, "Turn the money down.", "Put the name on the shirt."),

  card(31, "You beat your rival.", "When the banter starts.", "Next day", "Straight away", 1, -1, true, "You wait.", "The moment the whistle goes."),
  card(32, "You win a cup.", "How often you bring it up.", "When asked", "Any chance", 3, -1, true, "You do not raise it.", "You mention it whenever you can."),
  card(33, "A penalty, sudden death.", "Who takes it.", "Your taker", "Anyone brave", 5, -1, true, "The one whose job it is.", "Whoever has the nerve."),
  card(34, "He's one of your own.", "He came through the club. He is short of the level.", "Keep him", "Replace him", 6, -1, true, "He is yours.", "The level comes first."),
  card(35, "Naming the stand.", "They are selling the name.", "A supporter", "A company", 10, -1, true, "A person from the club.", "Sell the name."),
  card(36, "The win needed a dive.", "How you want it won.", "Clean", "The points", 11, -1, true, "You would rather not win it that way.", "Take the win."),
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

/** Fallback when a card has no weight of its own. */
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
