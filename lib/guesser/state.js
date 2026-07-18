import { verifyPayload } from "@/lib/signing";
import { gstDay, MAX_ATTEMPTS } from "./config";
import { guessPersonIdsFromRows } from "./dedupe";

export const GUESSER_COOKIE = "trf_guesser";

const EMPTY_GAME = {
  guesses: [],
  solved: false,
  attempts: 0,
  revealedClues: [],
};

export function parseGuesserCookie(token, day = gstDay()) {
  const payload = verifyPayload(token);
  if (!payload || payload.day !== day || typeof payload.games !== "object") {
    return { day, sid: null, games: {} };
  }
  return { day, sid: payload.sid ?? null, games: payload.games ?? {} };
}

export function getGame(state, mode) {
  const game = state.games[mode];
  if (!game) return { ...EMPTY_GAME, revealedClues: [] };
  return {
    guesses: Array.isArray(game.guesses) ? game.guesses : [],
    solved: Boolean(game.solved),
    attempts: Number(game.attempts) || 0,
    revealedClues: Array.isArray(game.revealedClues) ? game.revealedClues : [],
  };
}

/** Merge cookie game with signed-in DB progress for the same mode/day. */
export function mergeGameProgress(cookieGame, dbProgress) {
  const byPerson = new Map();

  for (const g of dbProgress?.guesses ?? []) {
    if (g.personId) byPerson.set(g.personId, g);
  }
  for (const g of cookieGame?.guesses ?? []) {
    if (g.personId) byPerson.set(g.personId, g);
  }

  const guesses = [...byPerson.values()];
  const revealedClues = [
    ...new Set([
      ...(cookieGame?.revealedClues ?? []),
      ...(dbProgress?.revealedClues ?? []),
    ]),
  ].sort((a, b) => a - b);

  return {
    guesses,
    solved: Boolean(cookieGame?.solved || dbProgress?.solved),
    attempts: Math.max(
      Number(cookieGame?.attempts) || 0,
      Number(dbProgress?.attempts) || 0,
      guesses.length
    ),
    revealedClues,
  };
}

export function cookieGuessPersonIds(state, mode) {
  return guessPersonIdsFromRows(getGame(state, mode).guesses);
}

export function isGameOver(game) {
  return game.solved || game.attempts >= MAX_ATTEMPTS;
}

export function compactGameForCookie(game) {
  return {
    guesses: game.guesses.map((g) => ({
      personId: g.personId,
      name: g.name,
    })),
    solved: game.solved,
    attempts: game.attempts,
    revealedClues: game.revealedClues ?? [],
  };
}

export function getPlayedModes(state) {
  return Object.entries(state.games ?? {})
    .filter(([, g]) => g.attempts > 0 || g.solved)
    .map(([mode]) => mode);
}
