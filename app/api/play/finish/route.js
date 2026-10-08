import { canFinish } from "@/lib/play/game.js";
import { saveOrWall } from "@/lib/play/finish.js";
import { playRoute } from "@/lib/play/route-guard.js";
import { conflict, db, fail, limited, loadSession, noDb, noSession, ok, saveState } from "@/lib/play/session.js";

export const runtime = "nodejs";

export function POST(req) {
  return playRoute("finish", async () => {
  const blocked = limited(req, "finish", 20);
  if (blocked) return blocked;
  const client = db();
  if (!client) return noDb();

  let row = await loadSession(req);
  if (!row) return noSession();

  if (!row.completed_at) {
    if (!canFinish(row.state)) return fail(409, "Answer the current question first.", { next: "refresh" });
    const state = { ...row.state, phase: "finished" };
    const completedAt = new Date().toISOString();
    if (!(await saveState(row, state, completedAt))) return conflict();
    row = { ...row, state, completed_at: completedAt, version: row.version + 1 };
  }

  // Replay after freezing returns the same summary, and the same save result.
  const r = await saveOrWall(client, row);
  return ok(r.body);
  });
}
