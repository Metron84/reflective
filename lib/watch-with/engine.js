export const DECK_SIZE = 16;
export const ELO_START = 1500;
export const ELO_K = 24;
export const MIN_PICK_GAP_MS = 400;
export const DAILY_RUN_CAP = 5;
export const COUNTING_VOTES = 30;

export function shuffle(list, random = Math.random) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = next[i];
    next[i] = next[j];
    next[j] = swap;
  }
  return next;
}

export function drawDeck(cards, size = DECK_SIZE, random = Math.random) {
  const pool = (cards ?? []).filter((card) => card.active);
  return shuffle(pool, random).slice(0, Math.min(size, pool.length));
}

export function expectedPair(deck, pickCount, incumbentId) {
  if (!Array.isArray(deck) || deck.length < 2) return null;
  if (pickCount >= deck.length - 1) return null;
  if (pickCount === 0) return [deck[0], deck[1]];
  if (!incumbentId) return null;
  const challenger = deck[pickCount + 1];
  if (!challenger) return null;
  return [incumbentId, challenger];
}

export function samePair(expected, winnerId, loserId) {
  if (!expected || !winnerId || !loserId || winnerId === loserId) return false;
  const left = [...expected].sort().join("|");
  const right = [winnerId, loserId].sort().join("|");
  return left === right;
}

export function applyElo(winnerElo, loserElo, k = ELO_K) {
  const expected = 1 / (1 + 10 ** ((loserElo - winnerElo) / 400));
  const winnerNext = winnerElo + k * (1 - expected);
  const loserNext = loserElo + k * (0 - (1 - expected));
  return {
    winnerElo: Math.round(winnerNext * 10) / 10,
    loserElo: Math.round(loserNext * 10) / 10,
  };
}

export function winRate(wins, votes) {
  if (!votes) return 0;
  return wins / votes;
}
