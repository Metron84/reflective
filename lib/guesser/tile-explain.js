const POSITION_LABELS = {
  GK: "goalkeeper",
  DF: "defender",
  MF: "midfielder",
  FW: "forward",
};

function arrowPhrase(hint, column) {
  if (!hint) return null;
  if (column === "birth_year") {
    return hint === "up"
      ? "born after the year shown"
      : "born before the year shown";
  }
  return hint === "up"
    ? "wears a higher shirt number than shown"
    : "wears a lower shirt number than shown";
}

/** Per-club chip tooltip on the live board. */
export function explainClubChip(clubName, chipStatus) {
  if (chipStatus === "correct") {
    return `Both played for ${clubName}.`;
  }
  return `The player we're looking for never played for ${clubName}.`;
}

/** Plain-language tooltip for one tile on the live board. */
export function explainTile(feedback) {
  const { key, status, value, hint, clubs } = feedback;

  if (key === "club" && clubs?.length) {
    return "Tap each club chip to see how it grades.";
  }

  if (status === "na" || value == null) {
    return "Not recorded for this player.";
  }

  if (key === "nationality") {
    if (status === "correct") return "Correct country.";
    if (status === "close") return "Different country, same confederation.";
    return "Wrong country.";
  }

  if (key === "league") {
    if (status === "correct") return "Correct league.";
    return "Wrong league.";
  }

  if (key === "club") {
    if (status === "correct") return "Correct club.";
    return "Wrong club.";
  }

  if (key === "position") {
    const pos = POSITION_LABELS[value] ?? value;
    if (status === "correct") return `Correct position (${pos}).`;
    if (status === "close") return `Close. Neighbouring position to ${pos}.`;
    return `Wrong position. You guessed ${pos}.`;
  }

  if (key === "birth_year" || key === "shirt_number") {
    const arrow = arrowPhrase(hint, key);
    if (status === "correct") {
      return key === "birth_year"
        ? "Correct birth year."
        : "Correct shirt number.";
    }
    if (status === "close") {
      return arrow
        ? `Close. The player we're looking for ${arrow}.`
        : "Close.";
    }
    return arrow
      ? `The player we're looking for ${arrow}.`
      : key === "birth_year"
        ? "Wrong birth year."
        : "Wrong shirt number.";
  }

  return "Wrong.";
}

/** Static annotations for the How to Play worked example. */
export const HOWTO_EXAMPLE = {
  guessName: "Kaká",
  answerName: "Ronaldinho",
  tiles: [
    {
      label: "Nation",
      value: "Brazil",
      status: "correct",
      note: "Correct country.",
    },
    {
      label: "League",
      value: "La Liga",
      status: "correct",
      note: "Correct league.",
    },
    {
      label: "Club",
      status: "correct",
      chips: [
        { name: "Barcelona", status: "correct" },
        { name: "Valencia", status: "wrong" },
        { name: "Atletico Madrid", status: "wrong" },
      ],
      note:
        "Each club in your guess is graded on its own. Green only if the answer played there too.",
    },
    {
      label: "Position",
      value: "MF",
      status: "correct",
      note: "Correct position (midfielder).",
    },
    {
      label: "Born",
      value: "1982 ↓",
      status: "close",
      note: "Close. The player we're looking for was born before 1982.",
    },
    {
      label: "Shirt",
      value: "8 ↓",
      status: "close",
      note: "Close. The player we're looking for wears a lower shirt number than 8.",
    },
  ],
};

export const LEGEND_ARROW_COPY = [
  "Nation: green is the exact country; amber is the same confederation.",
  "League: green is an exact match.",
  "Club: each of your player's clubs is its own chip. Green only if the answer played there too.",
  "Position: green is exact; amber is a neighbouring role (e.g. midfielder vs forward).",
  "Born: ↑ means the player was born after the year shown; ↓ means before.",
  "Shirt: ↑ means a higher number than shown; ↓ means lower.",
  "A dash means not recorded for that player.",
  "Close means something different per column. Tap any tile to see exactly what it is telling you.",
];

export const SHARE_SYMBOL_COPY =
  "Share grid: 🟩 correct · 🟨 close · ⬛ wrong · ⬜ not recorded.";
