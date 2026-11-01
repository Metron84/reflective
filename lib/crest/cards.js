/**
 * Crest swipe cards, deck v4.
 *
 * Thirty-six cards. Three different questions on each of the twelve rooms.
 * Life is the first five, then likes, then situations.
 *
 * Weight is how hard the answer pulls the match. A like is 1. Life and a
 * football situation are 1.5, because they are the person and the decision.
 * A door (no Both) is 2: sack or faith, old or new ground, the stands or a
 * fund, never or sign him, the fans or a billionaire.
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
 * @property {string} leftNote
 * @property {string} rightNote
 * @property {number} facet
 * @property {1|-1} leftValue
 * @property {boolean} allowBoth
 * @property {number} weight
 * @property {string} [context]
 */

/** Line under Both, on every card that allows it. */
export const BOTH_NOTE = "Either. You are not picking a side.";

/** Cards that are a decision. Left or right only. */
export const BINARY_CARD_IDS = [14, 16, 17, 18, 29];

/** @type {CrestCard[]} */
export const CARDS = [
  card(1, 1, "Fun, or work?", "Fun", "Work", 7, 1, "This one is you, before the club.", "In it for the enjoyment.", "Something you apply yourself to."),
  card(2, 1, "Moments, or the long run?", "Moments", "Surviving", 0, -1, "This one is you. What a season is for.", "The high points are the point.", "Staying in it matters more."),
  card(3, 1, "People, or quiet?", "People", "Quiet", 2, 1, "This one is you. The room around you.", "You want company.", "A smaller, quieter room."),
  card(4, 1, "Home, or the road?", "Home", "The road", 8, -1, "This one is you. Where the club lives in your life.", "Your own place.", "Out in the world."),
  card(5, 1, "Memory, or tomorrow?", "Memory", "Tomorrow", 9, -1, "This one is you. Which way you face.", "What has already been.", "What comes next."),

  card(6, 2, "Quiet Sunday, or the ride?", "Stroll", "Rollercoaster", 1, -1, "The match itself. The afternoon you want.", "A calm Sunday.", "A match that swings."),
  card(7, 2, "Whose bar is it?", "Regulars", "Anyone", 2, -1, "A closed room, or an open door.", "The same people, every week.", "Whoever walks in."),
  card(8, 2, "A 4-3, or a 1-0?", "4-3", "1-0", 4, -1, "The night you want from a match.", "Goals, and a night that could go anywhere.", "A tight win is enough."),
  card(9, 2, "A plan, or no plan?", "Planned", "No plan", 5, -1, "How the season should feel.", "You want to know the path.", "Take it as it comes."),
  card(10, 2, "Build it, or buy it?", "Build it", "Buy it", 6, -1, "How the squad is made.", "Grow your own players.", "Bring in who you need."),
  card(11, 2, "The derby, or the final?", "The derby", "The final", 3, -1, "The night that matters more.", "Beating the rival.", "The trophy night."),
  card(12, 2, "You lose to your rival.", "A few days", "Until we win", 0, -1, "How long that loss sits with you.", "Then it fades.", "It stays until you beat them."),
  card(13, 2, "The chance.", "One more pass", "Shoot", 4, -1, "You are in their box.", "Make the extra pass.", "Take the shot."),
  card(14, 2, "Five losses in a row.", "Sack him", "Keep faith", 7, -1, "The next day at the club.", "The manager goes.", "You give him more time."),
  card(15, 2, "The away end.", "Our songs", "New faces", 8, -1, "Who you want filling it.", "The people who know the songs.", "People new to the club."),
  card(16, 2, "The ground.", "Old ground", "New ground", 9, -1, "Stay, or move.", "Stay where you are.", "Move to a new one."),
  card(17, 2, "Who owns it?", "The stands", "A fund", 10, -1, "The people there, or outside money.", "The people in the ground.", "Outside money."),
  card(18, 2, "He mocked your fans.", "Never", "Sign him", 11, -1, "Principle, or the player.", "You do not sign him.", "You take him anyway."),
  card(19, 2, "Full time. You lost.", "Switch off", "Stay in it", 1, -1, "The rest of the night.", "Leave it there.", "The defeat stays with you."),
  card(20, 2, "He joins your rival.", "Cut off", "Not forever", 2, -1, "How long until you forgive him.", "He is done to you.", "In time, you let it go."),

  card(21, 3, "You're ahead.", "Hold it", "Chase another", 5, -1, "Ten minutes left. You are winning.", "See the game out.", "Go for one more goal."),
  card(22, 3, "The window.", "One more year", "Buy now", 6, -1, "The squad is short.", "Wait.", "Spend in this window."),
  card(23, 3, "The crowd, or the medal?", "The crowd", "The medal", 3, -1, "The thing you came for.", "The people in the ground.", "The prize."),
  card(24, 3, "A season with no trophy.", "You stay", "You look", 0, 1, "What you do next.", "This is still your club.", "You start looking elsewhere."),
  card(25, 3, "It was an ugly win.", "The performance", "The result", 4, -1, "What you wanted from the night.", "How the football looked.", "That you won."),
  card(26, 3, "The anthem, or the tactic?", "The tactic", "The anthem", 7, -1, "What decides the night for you.", "The plan on the pitch.", "The feeling in the ground."),
  card(27, 3, "Fans who never visit.", "Not really", "They're ours", 8, -1, "They watch from another country.", "They are not the same as the ground.", "A fan is a fan, wherever they watch."),
  card(28, 3, "The old song.", "Keep it", "Change it", 9, -1, "They want a new one before kickoff.", "The old song stays.", "Sing the new one."),
  card(29, 3, "The club is broke.", "The fans", "A billionaire", 10, -1, "Who saves it.", "The supporters keep it going.", "One rich owner saves it."),
  card(30, 3, "The sponsor fans hate.", "Refuse it", "Take it", 11, -1, "The name on the shirt.", "Turn the money down.", "Put the name on the shirt."),
  card(31, 3, "You beat your rival.", "Next day", "Straight away", 1, -1, "When the banter starts.", "You wait.", "The moment the whistle goes."),
  card(32, 3, "You win a cup.", "When asked", "Any chance", 3, -1, "How often you bring it up.", "You do not raise it.", "You mention it whenever you can."),
  card(33, 3, "A penalty, sudden death.", "Your taker", "Anyone brave", 5, -1, "Who takes it.", "The one whose job it is.", "Whoever has the nerve."),
  card(34, 3, "He's one of your own.", "Keep him", "Replace him", 6, -1, "He came through the club. He is short of the level.", "He is yours.", "The level comes first."),
  card(35, 3, "Naming the stand.", "A supporter", "A company", 10, -1, "They are selling the name.", "A person from the club.", "Sell the name."),
  card(36, 3, "The win needed a dive.", "Clean", "The points", 11, -1, "How you want it won.", "You would rather not win it that way.", "Take the win."),
];

/**
 * @param {number} id
 * @param {1|2|3} part
 * @param {string} question
 * @param {string} leftLabel
 * @param {string} rightLabel
 * @param {number} facet
 * @param {1|-1} leftValue
 * @param {string} context
 * @param {string} leftNote
 * @param {string} rightNote
 */
function card(id, part, question, leftLabel, rightLabel, facet, leftValue, context, leftNote, rightNote) {
  return {
    id,
    part,
    question,
    leftLabel,
    rightLabel,
    left: leftLabel,
    right: rightLabel,
    leftNote,
    rightNote,
    facet,
    leftValue,
    allowBoth: !BINARY_CARD_IDS.includes(id),
    weight: questionWeight(id, part),
    context,
  };
}

/**
 * A door is a real fork. Life and a situation outrank a like.
 *
 * @param {number} id
 * @param {1|2|3} part
 */
function questionWeight(id, part) {
  if (BINARY_CARD_IDS.includes(id)) return 2;
  if (part === 1 || part === 3) return 1.5;
  return 1;
}

/**
 * @param {CrestCard|null|undefined} card
 */
export function allowsBoth(card) {
  return Boolean(card) && card.allowBoth !== false;
}

/** Used only if a card has no weight of its own. */
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
