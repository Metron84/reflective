import { getUltimaDb } from "@/lib/ultima/server/db";

const MAX_QUEUE = 150;

/** Strings only, no repeats, a sane length. */
export function cleanIds(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.filter((id) => typeof id === "string" && id))].slice(0, MAX_QUEUE);
}

export async function readQueue(db, managerId) {
  const { data, error } = await db
    .from("ultima_draft_queues")
    .select("player_id, position")
    .eq("manager_id", managerId)
    .order("position");
  if (error) return null;
  return data ?? [];
}

/**
 * Replace a manager's queue in one atomic step. `baseIds` is the queue the client
 * loaded; if the stored queue differs, nothing is written and the current queue
 * comes back so the client can reload it.
 */
export async function saveQueue(managerId, body) {
  const requested = cleanIds(body?.player_ids);
  const baseIds = cleanIds(body?.base_ids);
  if (!requested || !baseIds) {
    return { status: 400, body: { code: "INVALID", message: "Invalid request." } };
  }

  const db = getUltimaDb();
  if (!db) return { status: 503, body: { code: "UNAVAILABLE", message: "The queue did not save. Try again." } };

  // Keep only players that exist, in the order sent.
  let playerIds = requested;
  if (requested.length) {
    const { data: known, error } = await db.from("ultima_players").select("id").in("id", requested);
    if (error) return { status: 503, body: { code: "UNAVAILABLE", message: "The queue did not save. Try again." } };
    const exists = new Set((known ?? []).map((row) => row.id));
    playerIds = requested.filter((id) => exists.has(id));
  }

  const { data, error } = await db.rpc("ultima_set_queue", {
    p_manager_id: managerId,
    p_player_ids: playerIds,
    p_base_ids: baseIds,
  });
  if (error || !data) {
    return { status: 503, body: { code: "UNAVAILABLE", message: "The queue did not save. Try again." } };
  }

  if (data.ok === false && data.code === "QUEUE_CONFLICT") {
    const queue = (data.queue ?? []).map((player_id, i) => ({ player_id, position: i + 1 }));
    return { status: 409, body: { ok: false, code: "QUEUE_CONFLICT", queue } };
  }
  if (data.ok !== true) {
    return { status: 503, body: { code: "UNAVAILABLE", message: "The queue did not save. Try again." } };
  }
  return { status: 200, body: { ok: true, saved: data.saved ?? playerIds.length } };
}
