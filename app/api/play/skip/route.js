import { QUESTIONS } from "@/lib/play/bank.js";
import { MAX_SKIPS, applySkip, skipsLeft, wheel } from "@/lib/play/game.js";
import { missingQuestion } from "@/lib/play/question-guard.js";
import { playRoute } from "@/lib/play/route-guard.js";
import { conflict, db, fail, limited, loadSession, noDb, noSession, ok, saveState } from "@/lib/play/session.js";

export const runtime = "nodejs";

const ERRORS = {
  expired: () => fail(409, "Time is up on this one.", { next: "answer" }),
  no_skips: () => fail(409, "No skips left. Give it your best shot.", { next: "answer" }),
};

async function skipPost(req, deps = {}) {
  const blocked = limited(req, "skip", 30);
  if (blocked) return blocked;
  const client = deps.client ?? db();
  if (!client) return noDb();

  const row = await loadSession(req, client);
  if (!row) return noSession();

  const questions = deps.questions ?? QUESTIONS;
  const missing = missingQuestion(row.state, questions);
  if (missing) return missing;

  const result = applySkip(questions, row.state, Date.now());
  if (result.error) return result.error === "none" ? conflict() : ERRORS[result.error]();
  if (!(await saveState(row, result.state, undefined, client))) return conflict();

  const q = questions.find((x) => x.id === row.state.pending.questionId);
  if (!q) return fail(409, "question_missing");
  return ok({
    correct: false,
    timedOut: false,
    skipped: true,
    pointsChange: 0,
    score: result.state.score,
    answered: result.state.answered,
    skipsUsed: result.state.skipsUsed,
    skipsLeft: skipsLeft(result.state),
    maxSkips: MAX_SKIPS,
    answer: q.answer,
    wheel: wheel(result.state),
    next: result.next,
  });
}

export function POST(req) {
  return playRoute("skip", () => skipPost(req));
}
