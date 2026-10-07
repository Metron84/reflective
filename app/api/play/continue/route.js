import { QUESTIONS } from "@/lib/play/bank.js";
import { applyContinue, wheel } from "@/lib/play/game.js";
import { conflict, db, fail, limited, loadSession, noDb, noSession, ok, saveState } from "@/lib/play/session.js";

export const runtime = "nodejs";

export async function POST(req) {
  const blocked = limited(req, "continue", 30);
  if (blocked) return blocked;
  if (!db()) return noDb();

  const body = await req.json().catch(() => null);
  const choice = body?.choice;
  if (choice !== "yes" && choice !== "no") return fail(400, "Choose yes or no.");

  const row = await loadSession(req);
  if (!row) return noSession();

  const state = applyContinue(QUESTIONS, row.state, choice === "yes");
  if (!state) return conflict();
  if (!(await saveState(row, state))) return conflict();

  return ok({
    next: state.phase === "spin" ? "spin" : "finished",
    wheel: wheel(state),
    score: state.score,
    answered: state.answered,
  });
}
