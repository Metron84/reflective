export const KOTB_PATH = "/king-of-the-burgers";

export const SCORING = [
  {
    key: "build_integrity",
    label: "Build integrity",
    description: "Does the burger hold together, or collapse in the hand?",
  },
  {
    key: "hand_feel",
    label: "Hand feel",
    description: "Weight, size, and whether you can eat it without a fight.",
  },
  {
    key: "ratio",
    label: "Ratio",
    description: "Bun, meat, and garnish in the right balance.",
  },
  {
    key: "the_meat",
    label: "The meat",
    description: "Seasoning, cook, and whether the patty is the point.",
  },
  {
    key: "bite_first_to_last",
    label: "Bite one to bite last",
    description: "The first bite and the last bite still belong to the same burger.",
  },
];

export const MAX_PANEL_SCORE = 10;
export const MAX_TOTAL_SCORE = 20;

export const KOTB_TOKENS = {
  space: { 4: 4, 8: 8, 12: 12, 16: 16, 24: 24, 32: 32 },
  rule: { hairline: "0.5px", default: "1px", active: "2px" },
  radius: 4,
  cream: "#F2EDE4",
  navy: "#0A111F",
  red: "#D8232A",
  neutral: "#D3D1C7",
  muted: "#5F5E5A",
};

const EMPTY_MEASURES = {
  build_integrity: 0,
  hand_feel: 0,
  ratio: 0,
  the_meat: 0,
  bite_first_to_last: 0,
};

function panel(panelId, panelName) {
  return {
    panelId,
    panelName,
    crest: null,
    measures: { ...EMPTY_MEASURES },
    score: 0,
  };
}

function sampleEntrant(name, shortName, panelA, panelB) {
  return {
    name,
    shortName,
    image: null,
    imageAlt: name,
    aggregate: 0,
    panelScores: [panel("panel-a", panelA), panel("panel-b", panelB)],
  };
}

export const MATCHES = [
  {
    id: "qf1",
    round: "QF",
    order: 1,
    status: "scheduled",
    scheduledAt: "2026-10-12T15:30:00.000Z",
    entrantA: sampleEntrant("Best Burger Ever", "Best", "Club A", "Club B"),
    entrantB: sampleEntrant("Juiciest On Earth", "Juiciest", "Club A", "Club B"),
    sourceA: null,
    sourceB: null,
    winnerTo: "sf1",
    winnerId: null,
  },
  {
    id: "qf2",
    round: "QF",
    order: 2,
    status: "scheduled",
    scheduledAt: "2026-10-12T16:30:00.000Z",
    entrantA: sampleEntrant("Too Big To Hold", "Too Big", "Club C", "Club D"),
    entrantB: sampleEntrant("Secret Sauce Hit", "Sauce", "Club C", "Club D"),
    sourceA: null,
    sourceB: null,
    winnerTo: "sf1",
    winnerId: null,
  },
  {
    id: "qf3",
    round: "QF",
    order: 3,
    status: "scheduled",
    scheduledAt: "2026-10-19T15:30:00.000Z",
    entrantA: sampleEntrant("Smash Till Cry", "Smash", "Club E", "Club F"),
    entrantB: sampleEntrant("Cheese Overload", "Cheese", "Club E", "Club F"),
    sourceA: null,
    sourceB: null,
    winnerTo: "sf2",
    winnerId: null,
  },
  {
    id: "qf4",
    round: "QF",
    order: 4,
    status: "scheduled",
    scheduledAt: "2026-10-19T16:30:00.000Z",
    entrantA: sampleEntrant("Last Bite Wins", "Last Bite", "Club G", "Club H"),
    entrantB: sampleEntrant("One Bite Hook", "Hook", "Club G", "Club H"),
    sourceA: null,
    sourceB: null,
    winnerTo: "sf2",
    winnerId: null,
  },
  {
    id: "sf1",
    round: "SF",
    order: 1,
    status: "scheduled",
    scheduledAt: null,
    entrantA: null,
    entrantB: null,
    sourceA: "Winner QF1",
    sourceB: "Winner QF2",
    winnerTo: "f1",
    winnerId: null,
  },
  {
    id: "sf2",
    round: "SF",
    order: 2,
    status: "scheduled",
    scheduledAt: null,
    entrantA: null,
    entrantB: null,
    sourceA: "Winner QF3",
    sourceB: "Winner QF4",
    winnerTo: "f1",
    winnerId: null,
  },
  {
    id: "f1",
    round: "F",
    order: 1,
    status: "scheduled",
    scheduledAt: null,
    entrantA: null,
    entrantB: null,
    sourceA: "Winner SF1",
    sourceB: "Winner SF2",
    winnerTo: null,
    winnerId: null,
  },
];

export const KOTB_FILMS = [
  {
    title: "They Invited Us Home",
    youtubeId: "RyvKEf5OFdk",
    href: "https://youtu.be/RyvKEf5OFdk",
    caption: "Garden on 8, Dubai.",
  },
  {
    title: "Spain in Dubai",
    youtubeId: "BYWHkaAPWOo",
    href: "https://youtu.be/BYWHkaAPWOo",
    caption: "Spain fans in the city.",
  },
  {
    title: "The Signs Were There",
    youtubeId: "lrRfE5PHSZI",
    href: "https://youtu.be/lrRfE5PHSZI",
    caption: "Spanish fans after the World Cup.",
  },
];

export function matchesForRound(round) {
  return MATCHES.filter((match) => match.round === round).sort(
    (a, b) => a.order - b.order,
  );
}

export function matchById(id) {
  return MATCHES.find((match) => match.id === id) ?? null;
}

export function roundLabel(round) {
  if (round === "QF") return "Quarters";
  if (round === "SF") return "Semis";
  return "Final";
}

export function tieCode(match) {
  return `${match.round}${match.order}`;
}

export function formatTieWhen(match) {
  if (match.status === "final") return "FINAL";
  if (match.status === "live") return "LIVE";
  if (!match.scheduledAt) return "TBC";
  const date = new Date(match.scheduledAt);
  const day = date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Dubai",
  });
  const time = date.toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  });
  return `${day.toUpperCase()}, ${time}`;
}

export function formatMatchMeta(match) {
  return `${tieCode(match)} · ${formatTieWhen(match)}`;
}

export function nextTieLabel(match) {
  if (!match.winnerTo) return null;
  const next = matchById(match.winnerTo);
  if (!next) return null;
  return `Winner advances to ${tieCode(next)}`;
}
