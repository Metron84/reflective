import { ULTIMA_DRAFT_ROUNDS, ULTIMA_MAX_SEATS } from "@/lib/ultima/constants";

/**
 * Snake draft pick order for 10 seats across N rounds.
 * @param {string[]} managerIds length 10
 * @param {number} [rounds=25]
 * @returns {Array<{ round: number, pickNumber: number, managerId: string }>}
 */
export function buildSnakeDraftOrder(managerIds, rounds = ULTIMA_DRAFT_ROUNDS) {
  if (managerIds.length !== ULTIMA_MAX_SEATS) {
    throw new Error(`Snake draft requires ${ULTIMA_MAX_SEATS} seats`);
  }
  const picks = [];
  let pickNumber = 1;
  for (let round = 1; round <= rounds; round += 1) {
    const order =
      round % 2 === 1 ? managerIds : [...managerIds].reverse();
    for (const managerId of order) {
      picks.push({ round, pickNumber, managerId });
      pickNumber += 1;
    }
  }
  return picks;
}

/**
 * Manager on the clock for a given pick number (1–250).
 */
export function managerOnClock(managerIds, pickNumber, rounds = ULTIMA_DRAFT_ROUNDS) {
  const order = buildSnakeDraftOrder(managerIds, rounds);
  return order[pickNumber - 1] ?? null;
}

/** Picks until this manager is on the clock. 0 if they are on it now. */
export function picksUntilManager(managerIds, currentPick, managerId, rounds = ULTIMA_DRAFT_ROUNDS) {
  const order = buildSnakeDraftOrder(managerIds, rounds);
  const start = Math.max(1, Number(currentPick) || 1);
  const from = order.findIndex((row) => row.pickNumber === start);
  if (from < 0) return null;
  for (let i = from; i < order.length; i += 1) {
    if (order[i].managerId === managerId) return i - from;
  }
  return null;
}
