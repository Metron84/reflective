import { verifyPayload } from "@/lib/signing";
import { gstDay, MAX_ATTEMPTS } from "./config";

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
