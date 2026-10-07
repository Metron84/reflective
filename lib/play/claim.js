import { summarize } from "./game.js";

/** A finished game can be saved for this long, so a sign-up round trip fits. */
export const CLAIM_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Save a finished game for a signed-in member through fan_quiz_claim().
 * Score, counts and completion time come from the session row only.
 * `client` must be the service-role client: the function is granted to service_role alone.
 */
export async function claimSession(client, row, userId, now = Date.now()) {
  if (!row.completed_at) return { status: 409, error: "Finish the game first." };
  if (row.claimed_by && row.claimed_by !== userId) {
    return { status: 409, error: "This game was already saved by another account." };
  }
  const s = summarize(row.state);
  if (s.answered < 1) return { status: 409, error: "Answer at least one question to save a score." };
  if (now - Date.parse(row.completed_at) > CLAIM_WINDOW_MS && !row.claimed_by) {
    return { status: 410, error: "This game is too old to save. Play again." };
  }

  const { data, error } = await client.rpc("fan_quiz_claim", {
    p_user: userId,
    p_session: row.id,
    p_score: s.score,
    p_answered: s.answered,
    p_correct: s.correct,
    p_incorrect: s.incorrect,
    p_completed: row.completed_at,
  });
  const r = Array.isArray(data) ? data[0] : data;
  if (error || !r) return { status: 500, error: "Could not save your score. Try again." };
  // The function is idempotent per session id, so another account's earlier claim comes back as theirs.
  if (r.out_user_id !== userId) {
    return { status: 409, error: "This game was already saved by another account." };
  }

  if (!row.claimed_by) {
    await client
      .from("fan_quiz_sessions")
      .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("claimed_by", null);
  }

  return {
    status: 200,
    saved: {
      score: r.out_score,
      answered: r.out_answered,
      correct: r.out_correct,
      incorrect: r.out_incorrect,
      counted: r.out_counted,
      alreadySaved: r.out_already_claimed,
    },
  };
}
