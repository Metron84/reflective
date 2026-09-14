import { SCALE } from "./quiz-content.js";

export const SENSES_COUNT = 5;

export const SENSES_INTRO =
  "Don't think too hard. You're walking towards the ground. What do you want?";

export const SENSES_QUESTIONS = [
  {
    id: "sight",
    label: "Sight",
    q: "Which matchday scene catches your eye?",
    a: [
      "An old ground under glowing floodlights",
      "Scarves and flags filling the stands",
      "A giant display taking over the stadium",
    ],
  },
  {
    id: "sound",
    label: "Sound",
    q: "Which sound gives you goosebumps?",
    a: [
      "One old song sung by everyone",
      "Chants bouncing between the stands",
      "Drums and noise that never stop",
    ],
  },
  {
    id: "touch",
    label: "Touch",
    q: "Where would you rather watch?",
    a: [
      "In my seat, taking everything in",
      "Shoulder to shoulder with the crowd",
      "Standing, bouncing, completely lost in it",
    ],
  },
  {
    id: "taste",
    label: "Taste",
    q: "What should matchday taste like?",
    a: [
      "The old favourite I always order",
      "Whatever the local fans swear by",
      "Something I have never tried before",
    ],
  },
  {
    id: "smell",
    label: "Smell",
    q: "Which smell says matchday to you?",
    a: [
      "Rain, grass and cold evening air",
      "Food cooking outside the ground",
      "Smoke, flares and a stadium in full voice",
    ],
  },
];

/**
 * @returns {(number|null)[]}
 */
export function emptySensesAnswers() {
  return Array(SENSES_COUNT).fill(null);
}

/**
 * Mean of 1–7 answers, scaled to 0–100.
 * @param {(number|null)[]} answers
 * @returns {number|null}
 */
export function sensesScore(answers) {
  const values = (answers ?? []).filter((v) => v === 1 || v === 4 || v === 7);
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return ((mean - SCALE[0]) / (SCALE[2] - SCALE[0])) * 100;
}

/**
 * @param {(number|null)[]} answers
 */
export function isSensesComplete(answers) {
  return (
    Array.isArray(answers) &&
    answers.length >= SENSES_COUNT &&
    answers.slice(0, SENSES_COUNT).every((v) => v === 1 || v === 4 || v === 7)
  );
}

/**
 * @param {number|null|undefined} value
 * @param {string} high
 * @param {string} low
 */
function pole(value, high, low) {
  return (value ?? 4) > 4 ? high : low;
}

/**
 * @param {(number|null)[]} answers
 */
export function sensoryParagraph(answers) {
  const sight = answers?.[0];
  const sound = answers?.[1];
  const touch = answers?.[2];
  const colour = pole(sight, "colour over restraint", "restraint over colour");
  const noise = pole(
    sound,
    "continuous sound over quiet anticipation",
    "quiet anticipation over continuous sound",
  );
  const closeness = pole(
    touch,
    "closeness over space",
    "space over closeness",
  );
  return `You are drawn not only to what a club stands for, but to how belonging feels. You favour ${colour}, ${noise}, and ${closeness}. You connect with a club you can see, hear and feel before anyone explains it.`;
}
