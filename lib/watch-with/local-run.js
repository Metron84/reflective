import { expectedPair } from "./engine.js";

/** Advance a presented run after a local pick. Deck cards stay from start. */
export function advanceRun(run, winnerId) {
  if (!run?.deck?.length || !winnerId) return run;
  const deck = run.deck;
  const ids = deck.map((card) => card.id);
  const made = run.done ? run.totalPicks : Math.max(0, (run.pick || 1) - 1);
  const nextMade = made + 1;
  const totalPicks = run.totalPicks;
  const done = nextMade >= totalPicks && totalPicks > 0;
  const pairIds = expectedPair(ids, nextMade, winnerId);
  const byId = new Map(deck.map((card) => [card.id, card]));
  return {
    ...run,
    pick: done ? totalPicks : nextMade + 1,
    done,
    needsComplete: done && !run.completedAt,
    incumbentId: winnerId,
    pair: pairIds ? pairIds.map((id) => byId.get(id)).filter(Boolean) : null,
    champion: done ? byId.get(winnerId) || null : null,
  };
}
