/** Four tensions, not a virtue rank. Thin clubs stay 4 / confidence 1. */

import TABLE from "./club-character-table.js";

export const CHARACTER_KEYS = /** @type {const} */ ([
  "integrity",
  "decency",
  "respect",
  "power",
]);

/** When character is answered, it enters the geometric mean as one group. */
export const CHARACTER_GROUP_WEIGHT = 0.33;

const DEFAULT_VALUES = {
  integrity: 4,
  decency: 4,
  respect: 4,
  power: 4,
};

const DEFAULT_CONFIDENCE = {
  integrity: 1,
  decency: 1,
  respect: 1,
  power: 1,
};

/**
 * @param {object} club
 * @returns {{ values: typeof DEFAULT_VALUES; confidence: typeof DEFAULT_CONFIDENCE }}
 */
export function resolveClubCharacter(club) {
  const row = club?.slug ? TABLE[club.slug] : null;
  const fromClub =
    club?.character && typeof club.character === "object" ? club.character : {};
  const fromClubConf =
    club?.character_confidence && typeof club.character_confidence === "object"
      ? club.character_confidence
      : {};

  /** @type {typeof DEFAULT_VALUES} */
  const values = { ...(row?.values ?? DEFAULT_VALUES) };
  /** @type {typeof DEFAULT_CONFIDENCE} */
  const confidence = { ...(row?.confidence ?? DEFAULT_CONFIDENCE) };

  for (const key of CHARACTER_KEYS) {
    if (typeof fromClub[key] === "number") values[key] = fromClub[key];
    if (typeof fromClubConf[key] === "number") confidence[key] = fromClubConf[key];
  }

  return { values, confidence };
}

/**
 * @param {{ integrity?: number|null; decency?: number|null; respect?: number|null; power?: number|null }|null|undefined} person
 */
export function hasCharacterAnswers(person) {
  if (!person) return false;
  return CHARACTER_KEYS.some((key) => person[key] != null);
}

export function characterTable() {
  return TABLE;
}
