import { saveOrWall } from "@/lib/play/finish.js";
import { playRoute } from "@/lib/play/route-guard.js";
import { db, fail, limited, loadSession, noDb, noSession, ok } from "@/lib/play/session.js";

export const runtime = "nodejs";

/**
 * Called after sign-in to save the game held by the fq_sid cookie.
 * The body is ignored: everything is read from the session row.
 */
export function POST(req) {
  return playRoute("claim", async () => {
  const blocked = limited(req, "claim", 20);
  if (blocked) return blocked;
  const client = db();
  if (!client) return noDb();

  const row = await loadSession(req);
  if (!row) return noSession();
  if (!row.completed_at) return fail(409, "Finish the game first.", { next: "refresh" });

  const r = await saveOrWall(client, row);
  return r.status === 200 ? ok(r.body) : fail(r.status, r.body.error, { summary: r.body.summary });
  });
}
