import { QUESTIONS, answerSeconds } from "@/lib/play/bank.js";
import { MAX_QUESTIONS, CONTINUE_AFTER, newState, wheel } from "@/lib/play/game.js";
import { db, fail, limited, noDb, ok, setCookie } from "@/lib/play/session.js";

export const runtime = "nodejs";

export async function POST(req) {
  const blocked = limited(req, "session", 10);
  if (blocked) return blocked;
  const client = db();
  if (!client) return noDb();

  const state = newState(QUESTIONS);
  if (!state.categories.length) return fail(503, "The wheel is warming up. Try again soon.");

  const { data, error } = await client.from("fan_quiz_sessions").insert({ state }).select("id").single();
  if (error || !data) return fail(500, "Could not start a game. Try again.");

  return setCookie(
    ok({
      categories: wheel(state),
      score: 0,
      answered: 0,
      maxQuestions: MAX_QUESTIONS,
      continueAfter: CONTINUE_AFTER,
      answerSeconds: answerSeconds(),
      next: "spin",
    }),
    data.id,
  );
}
