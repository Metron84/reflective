import { QUESTIONS, answerSeconds } from "@/lib/play/bank.js";
import { applySpin, canSpin, pickSpin, wheel } from "@/lib/play/game.js";
import { playRoute } from "@/lib/play/route-guard.js";
import { conflict, fail, limited, loadSession, noDb, noSession, ok, saveState, db } from "@/lib/play/session.js";

export const runtime = "nodejs";

export function POST(req) {
  return playRoute("spin", async () => {
  const blocked = limited(req, "spin", 60);
  if (blocked) return blocked;
  if (!db()) return noDb();

  const row = await loadSession(req);
  if (!row) return noSession();
  if (!canSpin(row.state)) return fail(409, "Finish the current step first.", { next: "refresh" });

  const q = pickSpin(QUESTIONS, row.state, Math.random);
  if (!q) return fail(409, "You have been through the whole wheel.", { next: "finished" });

  const seconds = answerSeconds();
  const state = applySpin(row.state, q, Date.now(), seconds);
  if (!(await saveState(row, state))) return conflict();

  return ok({
    category: q.category,
    value: q.value,
    questionId: q.id,
    clue: q.clue,
    deadline: state.pending.deadline,
    answerSeconds: seconds,
    wheel: wheel(state),
    score: state.score,
    answered: state.answered,
  });
  });
}
