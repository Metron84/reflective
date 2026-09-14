/** @typedef {{ Heart: number; Mind: number; Soul: number }} PillarWeights */

/** @typedef {{ integrity: number; decency: number; respect: number; power: number }} CharacterVector */

export const AFFINITY_COUNT = 12;
export const CHARACTER_COUNT = 4;
export const HEART_COUNT = 4;
export const MIND_COUNT = 4;
export const SOUL_COUNT = 4;
export const SENSES_COUNT = 5;

/** Heart + Mind + Feel the Match + Soul + Character + Balance + colour. */
export const QUIZ_STEP_COUNT =
  AFFINITY_COUNT + SENSES_COUNT + CHARACTER_COUNT + 2;

export const HEART_END = HEART_COUNT;
export const MIND_END = HEART_END + MIND_COUNT;
export const SENSES_START = MIND_END;
export const SENSES_END = SENSES_START + SENSES_COUNT;
export const SOUL_START = SENSES_END;
export const SOUL_END = SOUL_START + SOUL_COUNT;
export const CHARACTER_START = SOUL_END;
export const PILLAR_STEP_INDEX = CHARACTER_START + CHARACTER_COUNT;
export const COLOR_STEP_INDEX = PILLAR_STEP_INDEX + 1;

/**
 * @param {number} quizIndex
 * @returns {{ type: 'dimension' | 'sense' | 'character' | 'pillar' | 'color'; d?: number; i?: number; section: 'heart' | 'mind' | 'senses' | 'soul' }}
 */
export function flowAt(quizIndex) {
  if (quizIndex < HEART_END) {
    return { type: "dimension", d: quizIndex, section: "heart" };
  }
  if (quizIndex < MIND_END) {
    return { type: "dimension", d: quizIndex, section: "mind" };
  }
  if (quizIndex < SENSES_END) {
    return { type: "sense", i: quizIndex - SENSES_START, section: "senses" };
  }
  if (quizIndex < SOUL_END) {
    return { type: "dimension", d: quizIndex - SENSES_COUNT, section: "soul" };
  }
  if (quizIndex < PILLAR_STEP_INDEX) {
    return {
      type: "character",
      i: quizIndex - CHARACTER_START,
      section: "soul",
    };
  }
  if (quizIndex === PILLAR_STEP_INDEX) {
    return { type: "pillar", section: "soul" };
  }
  return { type: "color", section: "soul" };
}

/**
 * @param {number} quizIndex
 * @returns {'heart' | 'mind' | 'senses' | 'soul'}
 */
export function sectionAt(quizIndex) {
  return flowAt(quizIndex).section;
}

export const KIT_FAMILIES = [
  "red",
  "blue",
  "white",
  "black",
  "purple",
  "yellow",
  "green",
  "orange",
  "pink",
  "brown",
  "grey",
  "claret",
];

export const COLOR_Q = {
  q: "Which colours do you want least?",
  lead: "Tap three, worst first. The first shirt is out. The second is out if a country can survive it. The third only hurts fit.",
};

export const STORAGE_KEY = "crest-quiz-v5";

export const DIMS = [
  { id: "H1", pillar: "Heart", low: "Success", high: "Suffering" },
  { id: "H2", pillar: "Heart", low: "Calm", high: "Volatile" },
  { id: "H3", pillar: "Heart", low: "Belonging", high: "Distinction" },
  { id: "H4", pillar: "Heart", low: "Glory", high: "Journey" },
  { id: "M1", pillar: "Mind", low: "Results", high: "Aesthetics" },
  { id: "M2", pillar: "Mind", low: "Control", high: "Risk" },
  { id: "M3", pillar: "Mind", low: "Acquisition", high: "Development" },
  { id: "M4", pillar: "Mind", low: "Adaptability", high: "Ideology" },
  { id: "S1", pillar: "Soul", low: "Global", high: "Local" },
  { id: "S2", pillar: "Soul", low: "Modernity", high: "Heritage" },
  { id: "S3", pillar: "Soul", low: "Establishment", high: "Defiance" },
  { id: "S4", pillar: "Soul", low: "Entertainment", high: "Meaning" },
];

/** Three stances: pole, tension, pole. Maps to the 1–7 codebook. */
export const SCALE = [1, 4, 7];

export const QUESTIONS = [
  {
    d: 0,
    q: "You commit to a hard, years-long mission that looks like it is failing. People are walking away. What keeps you there?",
    a: [
      "Belief in winning",
      "Refusing to quit",
      "Bonding through struggle",
    ],
  },
  {
    d: 1,
    q: "You can choose the storyline of the next chapter of your life. What do you choose?",
    a: [
      "Safe and predictable",
      "Steady, normal growth",
      "Wild, beautiful chaos",
    ],
  },
  {
    d: 2,
    q: "You move to a massive, divided city and must choose a group to join. Which doors do you walk through?",
    a: [
      "Open to everyone",
      "Proud, protected traditions",
      "A tight, closed circle",
    ],
  },
  {
    d: 3,
    q: "At the end of a long, difficult pursuit, what proves the sacrifice was worth it?",
    a: [
      "The final victories",
      "The shared memories",
      "The long journey",
    ],
  },
  {
    d: 4,
    q: "You are in charge of a team in a high-stakes contest. What matters most?",
    a: [
      "The result, by any fair means",
      "Winning with style",
      "Playing beautifully first",
    ],
  },
  {
    d: 5,
    q: "You are running a massive project with everything on the line. How do you handle it?",
    a: [
      "Strict, absolute control",
      "A safe, balanced plan",
      "Room for bold swings",
    ],
  },
  {
    d: 6,
    q: "Your organisation needs someone for a critical role. Who gets the job?",
    a: [
      "Hire the proven expert",
      "Find the best fit",
      "Promote from within",
    ],
  },
  {
    d: 7,
    q: "The world is changing fast and your group is falling behind. How do you survive?",
    a: [
      "Change whatever it takes",
      "Update methods, keep values",
      "Stick to your philosophy",
    ],
  },
  {
    d: 8,
    q: "A local project you built is becoming world-famous. Who does it belong to now?",
    a: [
      "The whole world",
      "Everyone, but mostly locals",
      "The streets that made it",
    ],
  },
  {
    d: 9,
    q: "You inherit a historic institution that is struggling. How do you fix it?",
    a: [
      "Completely modernize it",
      "Update it, but keep traditions",
      "Keep what was handed down",
    ],
  },
  {
    d: 10,
    q: "A powerful system offers you a high-ranking place inside it. What is your move?",
    a: [
      "Join and lead them",
      "Join and change it from the inside",
      "Reject it and rebel",
    ],
  },
  {
    d: 11,
    q: "You return to the same ritual every week. What do you want from it?",
    a: [
      "A fun, easy escape",
      "Joy and community",
      "Deep personal meaning",
    ],
  },
];

/** Character lens: institutional tensions in the path, plus narrative. */
export const CHARACTER_DIMS = [
  { id: "C1", key: "integrity", theme: "Integrity", low: "Procedure", high: "Conscience" },
  { id: "C3", key: "decency", theme: "Decency", low: "Loyalty", high: "Impartiality" },
  { id: "C2", key: "respect", theme: "Respect", low: "Accountability", high: "Dignity" },
  { id: "C5", key: "power", theme: "Power", low: "Reform", high: "Resistance" },
];

export const CHARACTER_QUESTIONS = [
  {
    key: "integrity",
    q: "A legal loophole gives your group a massive advantage, but it feels unfair. What do you do?",
    a: [
      "Take the advantage",
      "Balance the rules with fairness",
      "Refuse to use it",
    ],
  },
  {
    key: "decency",
    q: "A close friend asks you to publicly defend something you know was wrong. How do you answer?",
    a: [
      "Stand with them, even if I disagree",
      "Support them privately, stay quiet publicly",
      "Stand for the truth",
    ],
  },
  {
    key: "respect",
    q: "Someone who treated you badly is publicly humiliated in front of you. What do you do?",
    a: [
      "Let them face it",
      "Stay out of it",
      "Step in and help them up",
    ],
  },
  {
    key: "power",
    q: "A new rule heavily punishes the weakest people in your community. How do you fight it?",
    a: [
      "Use the system to change it",
      "Ask for exceptions",
      "Protest and resist openly",
    ],
  },
];

export const CHARACTER_INTRO =
  "When loyalty and principle pull against each other, what do you do?";

export const PILLAR_Q = {
  q: "When you pledge yourself to something, what decides it?",
  a: [
    { t: "How it makes me feel", w: { Heart: 0.5, Mind: 0.25, Soul: 0.25 } },
    { t: "How it thinks and works", w: { Heart: 0.25, Mind: 0.5, Soul: 0.25 } },
    { t: "What it stands for", w: { Heart: 0.25, Mind: 0.25, Soul: 0.5 } },
    { t: "All three equally", w: { Heart: 0.34, Mind: 0.33, Soul: 0.33 } },
  ],
};

export const INSTALL_SEEN_KEY = "crest-install-prompt-seen";
