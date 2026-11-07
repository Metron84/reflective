/** Panel-locked quiz: twelve dimensions + pillar. Five taps → 1 · 2.5 · 4 · 5.5 · 7. */

/** @typedef {{ Heart: number; Mind: number; Soul: number }} PillarWeights */

export const AFFINITY_COUNT = 12;
export const HEART_COUNT = 4;
export const MIND_COUNT = 4;
export const SOUL_COUNT = 4;

export const HEART_END = HEART_COUNT;
export const MIND_END = HEART_END + MIND_COUNT;
export const SOUL_END = MIND_END + SOUL_COUNT;
export const PILLAR_STEP_INDEX = SOUL_END;
/** Twelve affinity + one pillar. */
export const QUIZ_STEP_COUNT = AFFINITY_COUNT + 1;

/**
 * @param {number} quizIndex
 * @returns {{ type: 'dimension' | 'pillar'; d?: number; section: 'heart' | 'mind' | 'soul' }}
 */
export function flowAt(quizIndex) {
  if (quizIndex < HEART_END) {
    return { type: "dimension", d: quizIndex, section: "heart" };
  }
  if (quizIndex < MIND_END) {
    return { type: "dimension", d: quizIndex, section: "mind" };
  }
  if (quizIndex < SOUL_END) {
    return { type: "dimension", d: quizIndex, section: "soul" };
  }
  return { type: "pillar", section: "soul" };
}

/**
 * @param {number} quizIndex
 * @returns {'heart' | 'mind' | 'soul'}
 */
export function sectionAt(quizIndex) {
  return flowAt(quizIndex).section;
}

export const SCALE = [1, 2.5, 4, 5.5, 7];

/** Legacy kit list kept for colour-veto helpers (not used in panel quiz). */
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

export const QUESTIONS = [
  {
    d: 0,
    q: "When the club wins, it feels like the point. When it suffers, that is also the point.",
    a: [
      "Winning is the point",
      "Mostly winning",
      "Either",
      "Mostly the hard years",
      "The hard years are the point",
    ],
  },
  {
    d: 1,
    q: "Some clubs feel controlled. Others live in jeopardy every week.",
    a: [
      "Calm and inevitable",
      "Mostly calm",
      "Either",
      "Mostly dramatic",
      "Chaotic every week",
    ],
  },
  {
    d: 2,
    q: "Everyone around you understands the club, or almost no one does.",
    a: [
      "Everyone gets it",
      "Mostly shared",
      "Either",
      "Mostly niche",
      "Almost no one gets it",
    ],
  },
  {
    d: 3,
    q: "Trophies are why you follow, or the years and the travel are why you follow.",
    a: [
      "Trophies",
      "Mostly trophies",
      "Either",
      "Mostly the years",
      "The years and the ritual",
    ],
  },
  {
    d: 4,
    q: "Winning by any means, or the way the team plays even when it costs.",
    a: [
      "Win by any means",
      "Mostly results",
      "Either",
      "Mostly style",
      "Style even at a cost",
    ],
  },
  {
    d: 5,
    q: "Structure and game management, or freedom and accepted chaos.",
    a: [
      "Structure and control",
      "Mostly structure",
      "Either",
      "Mostly freedom",
      "Freedom and risk",
    ],
  },
  {
    d: 6,
    q: "Buying finished players, or building and trusting what the club grows.",
    a: [
      "Buy finished players",
      "Mostly buy",
      "Either",
      "Mostly build",
      "Build and trust",
    ],
  },
  {
    d: 7,
    q: "The approach changes with each manager, or one idea lasts across eras.",
    a: [
      "Changes every era",
      "Mostly changes",
      "Either",
      "Mostly one idea",
      "One idea across generations",
    ],
  },
  {
    d: 8,
    q: "The club belongs to the world, or it belongs to one city.",
    a: [
      "Belongs to the world",
      "Mostly global",
      "Either",
      "Mostly local",
      "Belongs to the city",
    ],
  },
  {
    d: 9,
    q: "The club reinvents itself, or it keeps the old songs and rituals.",
    a: [
      "Reinvents itself",
      "Mostly modern",
      "Either",
      "Mostly tradition",
      "Custodian of the old ways",
    ],
  },
  {
    d: 10,
    q: "Part of the established order, or defined against it.",
    a: [
      "Establishment",
      "Mostly inside",
      "Either",
      "Mostly outsider",
      "Defined against the system",
    ],
  },
  {
    d: 11,
    q: "Football as release and entertainment, or as purpose and identity.",
    a: [
      "Entertainment and release",
      "Mostly entertainment",
      "Either",
      "Mostly meaning",
      "Purpose beyond the result",
    ],
  },
];

export const PILLAR_Q = {
  q: "How do you mainly follow?",
  a: [
    { t: "I follow with my gut", w: { Heart: 0.5, Mind: 0.25, Soul: 0.25 } },
    {
      t: "I love the ideas in football",
      w: { Heart: 0.25, Mind: 0.5, Soul: 0.25 },
    },
    {
      t: "I need to believe in the club",
      w: { Heart: 0.25, Mind: 0.25, Soul: 0.5 },
    },
    { t: "All three, equally", w: { Heart: 0.34, Mind: 0.33, Soul: 0.33 } },
  ],
};

/** Bump so mid-quiz users do not resume a dead schema. */
export const STORAGE_KEY = "crest-quiz-v6-panel";
export const INSTALL_SEEN_KEY = "crest-install-prompt-seen";

export const OPENING_TAGLINE =
  "Find the club that sounds like your heart, thinks like your mind and feels like your soul.";

export const OWNED_Q = "Do you already follow a club?";
export const OWNED_HINT = "We will not ask you to leave it.";
