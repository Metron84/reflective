/** Opposite-pole veto and ELECTRE-style discordance. Intra-stratum only. */

import {
  CHARACTER_KEYS,
  resolveClubCharacter,
} from "./club-character.js";

export const HARD_VETO_CONFIDENCE = 3;
export const DISCORD_CONFIDENCE = 2;
export const PILLAR_FIT_FLOOR = 0.05;
export const DISCORD_Q = 0.5;
export const DISCORD_V = 1;

/**
 * @param {number} person
 * @param {number} club
 */
export function similarity(person, club) {
  return 1 - Math.abs(person - club) / 6;
}

/**
 * @param {number} person
 * @param {number} club
 */
export function oppositeSides(person, club) {
  return (person - 4) * (club - 4) < 0;
}

/**
 * @param {number|null|undefined} person
 * @param {number|null|undefined} club
 * @param {number|null|undefined} confidence
 */
export function isHardVeto(person, club, confidence) {
  if (person == null || club == null) return false;
  if (person === 4 || club === 4) return false;
  if ((confidence ?? 0) < HARD_VETO_CONFIDENCE) return false;
  return oppositeSides(person, club);
}

/**
 * @param {(number|null)[]} scores
 * @param {{ vector: number[]; confidence?: number[] }} club
 * @param {{ integrity?: number|null; decency?: number|null; respect?: number|null; power?: number|null }|null} [personCharacter]
 */
export function vetoCount(scores, club, personCharacter = null) {
  let n = 0;
  for (let d = 0; d < 12; d++) {
    const person = scores[d];
    if (person == null) continue;
    if (isHardVeto(person, club.vector[d], club.confidence?.[d])) n += 1;
  }
  return n + characterVetoCount(personCharacter, club);
}

/**
 * @param {{ integrity?: number|null; decency?: number|null; respect?: number|null; power?: number|null }|null|undefined} person
 * @param {object} club
 */
export function characterVetoCount(person, club) {
  if (!person) return 0;
  const clubChar = resolveClubCharacter(club);
  let n = 0;
  for (const key of CHARACTER_KEYS) {
    const value = person[key];
    if (value == null) continue;
    if (isHardVeto(value, clubChar.values[key], clubChar.confidence[key])) {
      n += 1;
    }
  }
  return n;
}

/**
 * @param {number|null|undefined} person
 * @param {number|null|undefined} club
 * @param {number|null|undefined} confidence
 */
export function discordance(person, club, confidence) {
  if (person == null || club == null) return 0;
  if ((confidence ?? 0) !== DISCORD_CONFIDENCE) return 0;
  if (!oppositeSides(person, club)) return 0;
  const mismatch = 1 - similarity(person, club);
  if (mismatch <= DISCORD_Q) return 0;
  if (mismatch >= DISCORD_V) return 1;
  return (mismatch - DISCORD_Q) / (DISCORD_V - DISCORD_Q);
}

/**
 * @param {number} concordance
 * @param {(number|null)[]} scores
 * @param {{ vector: number[]; confidence?: number[] }} club
 * @param {{ integrity?: number|null; decency?: number|null; respect?: number|null; power?: number|null }|null} [personCharacter]
 */
export function applyDiscordance(concordance, scores, club, personCharacter = null) {
  if (concordance >= 1) return concordance;
  let sigma = concordance;
  for (let d = 0; d < 12; d++) {
    const person = scores[d];
    if (person == null) continue;
    const D = discordance(person, club.vector[d], club.confidence?.[d]);
    if (D > concordance) {
      sigma *= (1 - D) / (1 - concordance);
    }
  }
  if (personCharacter) {
    const clubChar = resolveClubCharacter(club);
    for (const key of CHARACTER_KEYS) {
      const person = personCharacter[key];
      if (person == null) continue;
      const D = discordance(person, clubChar.values[key], clubChar.confidence[key]);
      if (D > concordance) {
        sigma *= (1 - D) / (1 - concordance);
      }
    }
  }
  return Math.min(1, Math.max(0, sigma));
}

/**
 * @param {{ vetoCount?: number }[]} entries
 */
export function bestStratum(entries) {
  if (!entries.length) return 0;
  return Math.min(...entries.map((e) => e.vetoCount ?? 0));
}

/**
 * @param {{ vetoCount?: number }[]} entries
 */
export function inBestStratum(entries) {
  const stratum = bestStratum(entries);
  return entries.filter((e) => (e.vetoCount ?? 0) === stratum);
}
