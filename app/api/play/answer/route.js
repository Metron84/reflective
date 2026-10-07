import { QUESTIONS } from "@/lib/play/bank.js";
import { applyAnswer, wheel } from "@/lib/play/game.js";
import { conflict, db, fail, limited, loadSession, noDb, noSession, ok, saveState } from "@/lib/play/session.js";

export const runtime = "nodejs";

export async function POST(req) {
  const blocked = limited(req, "answer", 60);
  if (blocked) return blocked;
  if (!db()) return noDb();

  const body = await req.json().catch(() => null);
  const text = typeof body?.answer === "string" ? body.answer.slice(0, 200) : "";
  // Honeypot: real players never fill this.
  if (body?.website) return fail(400, "Something went wrong. Try again.");

  const row = await loadSession(req);
  if (!row) return noSession();

  // A replayed answer finds no pending question and gets a 409.
  const result = applyAnswer(QUESTIONS, row.state, text, Date.now());
  if (!result) return conflict();
  if (!(await saveState(row, result.state))) return conflict();

  const q = QUESTIONS.find((x) => x.id === row.state.pending.questionId);
  return ok({
    correct: result.correct,
    timedOut: result.timedOut,
    pointsChange: result.pointsChange,
    score: result.state.score,
    answered: result.state.answered,
    answer: q.answer,
    wheel: wheel(result.state),
    next: result.next,
  });
}
