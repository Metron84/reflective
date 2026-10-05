import { BROADCAST_BODY_MAX, BROADCAST_TITLE_MAX } from "@/lib/ultima/notifications/limits";
import { getManagerEmailsForCompetition } from "@/lib/ultima/server/managers";
import { createNotifications } from "@/lib/ultima/server/notifications";
import { sendUltimaEmail } from "@/lib/ultima/server/notify";
import { getLoggedDb, getReadDb } from "@/lib/ultima/server/strict-db";

export { BROADCAST_BODY_MAX, BROADCAST_TITLE_MAX };

/** A pinned card leaves the Hub after a week. */
export const PINNED_DAYS = 7;

export function cleanBroadcast({ title, body }) {
  const t = typeof title === "string" ? title.trim() : "";
  const b = typeof body === "string" ? body.trim() : "";
  if (!t || !b) return { ok: false, message: "Add a title and a message." };
  if (t.length > BROADCAST_TITLE_MAX) {
    return { ok: false, message: `Title is ${BROADCAST_TITLE_MAX} characters at most.` };
  }
  if (b.length > BROADCAST_BODY_MAX) {
    return { ok: false, message: `Message is ${BROADCAST_BODY_MAX} characters at most.` };
  }
  return { ok: true, title: t, body: b };
}

/**
 * Commissioner broadcast: a row, a push and inbox item for every human manager,
 * an email through the existing email path, and a pinned Hub card if asked.
 * The caller checks commissioner rights.
 */
export async function sendBroadcast({ competitionId, userId, title, body, pinned = false }) {
  const db = getLoggedDb("broadcast");
  if (!db || !competitionId) return { ok: false, code: "UNAVAILABLE" };

  const clean = cleanBroadcast({ title, body });
  if (!clean.ok) return { ok: false, code: "INVALID", message: clean.message };

  const { data: row, error } = await db
    .from("ultima_broadcasts")
    .insert({
      competition_id: competitionId,
      title: clean.title,
      body: clean.body,
      pinned: Boolean(pinned),
      created_by: userId ?? null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, code: "UNAVAILABLE" };

  const { data: managers } = await db
    .from("ultima_managers")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("is_bot", false);

  const { created } = await createNotifications(
    (managers ?? []).map((m) => ({
      managerId: m.id,
      competitionId,
      kind: "broadcast",
      title: clean.title,
      body: clean.body,
      link: "/ultima",
    })),
  );

  let emailed = 0;
  try {
    const recipients = await getManagerEmailsForCompetition(competitionId);
    const results = await Promise.allSettled(
      recipients.map((r) =>
        sendUltimaEmail({
          to: r.email,
          subject: `Ultima: ${clean.title}`,
          headline: clean.title,
          body: clean.body,
          ctaLabel: "Open Ultima",
          ctaHref: "/ultima",
        }),
      ),
    );
    emailed = results.filter((r) => r.status === "fulfilled" && !r.value?.skipped).length;
  } catch (err) {
    console.error("[ultima/broadcast] email failed:", err?.message || err);
  }

  await db.from("ultima_admin_log").insert({
    actor_id: userId ?? null,
    action: "broadcast_sent",
    reason: clean.title,
    payload: { broadcast_id: row.id, pinned: Boolean(pinned), managers: created },
  });

  return { ok: true, id: row.id, managers: created, emailed };
}

/** The latest pinned broadcast still inside its week, for the Hub card. */
export async function getPinnedBroadcast(competitionId, now = Date.now()) {
  const db = getReadDb();
  if (!db || !competitionId) return null;
  const since = new Date(now - PINNED_DAYS * 86_400_000).toISOString();
  const { data } = await db
    .from("ultima_broadcasts")
    .select("id, title, body, created_at")
    .eq("competition_id", competitionId)
    .eq("pinned", true)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}
