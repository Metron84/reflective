/** @typedef {{ integrity: number; decency: number; respect: number; power: number }} CharacterVector */

/**
 * @param {number} v 1–7
 * @returns {"low" | "mid" | "high"}
 */
function band(v) {
  if (v <= 2.5) return "low";
  if (v >= 5.5) return "high";
  return "mid";
}

const INTEGRITY = {
  low: "You tend to trust clear rules and written standards when the group is under pressure.",
  mid: "You weigh the letter of a rule against whether it still feels fair.",
  high: "You expect institutions to answer to conscience, not only to what is technically allowed.",
};

const DECENCY = {
  low: "When someone close to you is in the wrong, you protect the relationship first and push back in private.",
  mid: "You try to stay honest without abandoning people you care about.",
  high: "You hold friends to the same standard as anyone else, even when that costs you.",
};

const RESPECT = {
  low: "You believe people should face the consequences of how they behave.",
  mid: "You draw a line between accountability and public humiliation.",
  high: "You protect dignity even in rivalry, without asking for gratitude in return.",
};

const POWER = {
  low: "When a system looks neutral, you work inside it and improve it step by step.",
  mid: "You notice who bears the cost of “fair” rules and push through proper channels.",
  high: "You are willing to challenge power openly when the burden falls on those with least influence.",
};

/**
 * Interpretive passage for results. Not a moral score.
 * @param {CharacterVector} character
 * @returns {string}
 */
export function characterNarrative(character) {
  const parts = [
    INTEGRITY[band(character.integrity)],
    DECENCY[band(character.decency)],
    RESPECT[band(character.respect)],
    POWER[band(character.power)],
  ];

  const highConscience = band(character.integrity) === "high";
  const highDignity = band(character.respect) === "high";
  const highImpartial = band(character.decency) === "high";
  const highResistance = band(character.power) === "high";

  let bridge =
    "Your club matches below reflect cultural fit. This is how you tend to act when belonging is tested.";

  if (highConscience && highDignity && (highImpartial || highResistance)) {
    bridge =
      "You are drawn to strong identities, but your loyalty is not unconditional. You expect fairness under pressure, dignity in rivalry, and the courage to question your own side when it matters.";
  } else if (highConscience && highDignity) {
    bridge =
      "You want institutions with character, and you expect them to protect dignity even when advantage is on the line.";
  } else if (highResistance && band(character.integrity) !== "low") {
    bridge =
      "You notice who pays when rules look neutral, and you are not quick to treat compliance as the same thing as justice.";
  }

  return `${bridge} ${parts.join(" ")}`;
}
