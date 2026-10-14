import { saltedHash } from "@/lib/signing";
import { getServiceClient } from "@/lib/supabase";

/**
 * Write one finished or in-progress game to `plays`. Signed in: one row per user, day and mode.
 * Signed out: one anonymous row per session hash, day and mode.
 */
export async function recordPlay(state, mode, game, userId = null) {
  const supabase = getServiceClient();
  if (!supabase) return;
  if (!userId && !state.sid) return;

  const row = {
    puzzle_date: state.day,
    mode,
    guesses: {
      rows: game.guesses,
      revealedClues: game.revealedClues ?? [],
    },
    solved: game.solved,
    attempts: game.attempts,
    user_id: userId,
    session_hash: userId ? null : saltedHash(state.sid),
  };

  const conflict = userId
    ? "user_id,puzzle_date,mode"
    : "session_hash,puzzle_date,mode";

  await supabase
    .from("plays")
    .upsert(row, { onConflict: conflict, ignoreDuplicates: false })
    .then(() => {}, () => {});
}
