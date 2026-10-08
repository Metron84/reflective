import { QUESTIONS } from "@/lib/play/bank.js";
import { applyAnswer, wheel } from "@/lib/play/game.js";
import { missingQuestion } from "@/lib/play/question-guard.js";
import { playRoute } from "@/lib/play/route-guard.js";
import { conflict, db, fail, limited, loadSession, noDb, noSession, ok, saveState } from "@/lib/play/session.js";

export const runtime = "nodejs";

async function answerPost(req, deps = {}) {
  const blocked = limited(req, "answer", 60);
  if (blocked) return blocked;
  const client = deps.client ?? db();
  if (!client) return noDb();

  const body = await req.json().catch(() => null);
  const text = typeof body?.answer === "string" ? body.answer.slice(0, 200) : "";
  // Honeypot: real players never fill this.
  if (body?.website) return fail(400, "Something went wrong. Try again.");

  const row = await loadSession(req, client);
  if (!row) return noSession();

  const questions = deps.questions ?? QUESTIONS;
  const missing = missingQuestion(row.state, questions);
  if (missing) return missing;

  // A replayed answer finds no pending question and gets a 409.
  const result = applyAnswer(questions, row.state, text, Date.now());
  if (!result) return conflict();
  if (!(await saveState(row, result.state, undefined, client))) return conflict();

  const q = questions.find((x) => x.id === row.state.pending.questionId);
  if (!q) return fail(409, "question_missing");
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

export function POST(req) {
  return playRoute("answer", () => answerPost(req));
}
