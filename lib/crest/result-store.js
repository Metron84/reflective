import { BINARY_CARD_IDS, CARDS, TOTAL, allowsBoth } from "./cards.js";
import { arrivalSummary } from "./engine.js";
import { isStake } from "./stakes.js";
import { CREST_GROUPS } from "./clubs.js";

/**
 * @param {unknown} raw
 * @returns {{answers: {cardId: number, value: 1|0|-1}[], stake: string|null, scope: string|null}|{error: string}}
 */
export function parseBallot(raw) {
  if (!raw || typeof raw !== "object") return { error: "Missing ballot." };
  const answers = Array.isArray(raw.answers) ? raw.answers : null;
  if (!answers || answers.length !== TOTAL) return { error: "Need eighteen answers." };

  const used = new Set();
  const next = [];
  for (const row of answers) {
    if (!row || typeof row !== "object") return { error: "Bad answer." };
    const card = CARDS.find((c) => c.id === row.cardId);
    if (!card || used.has(card.id)) return { error: "Bad card." };
    used.add(card.id);
    const value = row.value;
    if (value !== 1 && value !== -1 && value !== 0) return { error: "Bad swipe." };
    if (value === 0 && !allowsBoth(card) && BINARY_CARD_IDS.includes(card.id)) {
      return { error: "That card is left or right only." };
    }
    next.push({ cardId: card.id, value });
  }
  if (used.size !== TOTAL) return { error: "Need every card." };

  const stake = raw.stake == null || raw.stake === "" ? null : String(raw.stake);
  if (stake && !isStake(stake)) return { error: "Bad chip." };
  const scope = raw.scope == null || raw.scope === "" ? null : String(raw.scope);
  if (scope && !CREST_GROUPS.includes(scope)) return { error: "Bad scope." };

  return { answers: next, stake, scope };
}

/**
 * @param {{answers: {cardId: number, value: 1|0|-1}[], stake: string|null, scope: string|null}} ballot
 */
export function snapshotFromBallot(ballot) {
  const summary = arrivalSummary(ballot.answers, undefined, {
    group: ballot.scope,
    stake: ballot.stake,
  });
  return {
    club_slug: summary.club.slug,
    room_pct: Math.round(Math.max(0, Math.min(1, summary.probability)) * 100),
  };
}
