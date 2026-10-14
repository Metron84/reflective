import { getShippableModes } from "@/lib/guesser/players";
import { getGame, isGameOver } from "@/lib/guesser/state";

/**
 * After sign-up, save today's finished cookie games to the new member's `plays` rows.
 * Past days are not claimable: the cookie only ever holds today's games.
 *
 * A mode the member already has a row for today is skipped, so a claim never overwrites a
 * game they played while signed in. Writes use the same `plays` upsert as a signed-in guess.
 *
 * @param {{state: {day: string, games: object}, userId: string, deps: {
 *   playedModes: (userId: string, day: string) => Promise<string[]>,
 *   hydrate: (mode: string, game: object, day: string) => Promise<object>,
 *   record: (state: object, mode: string, game: object, userId: string) => Promise<void>,
 *   modes?: string[],
 * }}} args
 * @returns {Promise<string[]>} the modes that were claimed
 */
export async function claimGuesserGames({ state, userId, deps }) {
  if (!userId || !state?.games) return [];
  const allowed = new Set(deps.modes ?? getShippableModes().map((m) => m.slug));
  const already = new Set(await deps.playedModes(userId, state.day));
  const claimed = [];

  for (const mode of Object.keys(state.games)) {
    if (!allowed.has(mode) || already.has(mode)) continue;
    const game = getGame(state, mode);
    if (!isGameOver(game)) continue;
    const hydrated = await deps.hydrate(mode, game, state.day);
    await deps.record(state, mode, hydrated, userId);
    claimed.push(mode);
  }
  return claimed;
}
