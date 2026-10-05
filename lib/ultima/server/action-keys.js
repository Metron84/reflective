import { getUltimaDb } from "@/lib/ultima/server/db";

/** A key claimed longer ago than this never finished. A new request may take it over. */
export const STALE_CLAIM_MS = 45_000;

const KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

/** The Idempotency-Key header, or null when it is missing or malformed. */
export function readActionKey(request) {
  const value = request?.headers?.get?.("idempotency-key");
  return typeof value === "string" && KEY_PATTERN.test(value) ? value : null;
}

/**
 * Claim a key before the write runs.
 * { state: "claimed" }              first request, go ahead
 * { state: "replay", result }       finished earlier, return the stored result
 * { state: "busy" }                 the first request is still running
 * { state: "mismatch" }             the key belongs to another route
 * { state: "skip" }                 the table is not there; run without a key
 */
export async function claimActionKey({ key, managerId, route, now = Date.now() }) {
  const db = getUltimaDb();
  if (!db) return { state: "skip" };

  const { error } = await db
    .from("ultima_action_keys")
    .insert({ key, manager_id: managerId, route });
  if (!error) return { state: "claimed" };

  // 42P01: table missing (migration 0056 not applied yet). Writes still work.
  if (error.code === "42P01" || error.code === "PGRST205") return { state: "skip" };
  if (error.code !== "23505") {
    console.error("[ultima/action-keys] claim failed", error.message);
    return { state: "skip" };
  }

  const { data: row } = await db
    .from("ultima_action_keys")
    .select("route, result, created_at")
    .eq("manager_id", managerId)
    .eq("key", key)
    .maybeSingle();
  if (!row) return { state: "busy" };
  if (row.route !== route) return { state: "mismatch" };
  if (row.result) return { state: "replay", result: row.result };

  const age = now - new Date(row.created_at).getTime();
  if (age < STALE_CLAIM_MS) return { state: "busy" };

  // The first request died before it stored anything. Take the claim over, once.
  const { data: taken } = await db
    .from("ultima_action_keys")
    .update({ created_at: new Date(now).toISOString() })
    .eq("manager_id", managerId)
    .eq("key", key)
    .eq("created_at", row.created_at)
    .is("result", null)
    .select("key")
    .maybeSingle();
  return taken ? { state: "claimed" } : { state: "busy" };
}

/** Store the outcome so a repeated key returns it. */
export async function finishActionKey({ key, managerId, result }) {
  const db = getUltimaDb();
  if (!db) return;
  const { error } = await db
    .from("ultima_action_keys")
    .update({ result })
    .eq("manager_id", managerId)
    .eq("key", key);
  if (error) console.error("[ultima/action-keys] store failed", error.message);
}

/** Free a claim after a failure that wrote nothing, so the same key may try again. */
export async function releaseActionKey({ key, managerId }) {
  const db = getUltimaDb();
  if (!db) return;
  await db
    .from("ultima_action_keys")
    .delete()
    .eq("manager_id", managerId)
    .eq("key", key)
    .is("result", null);
}

/** What the status check reports for a key. */
export async function lookupActionKey({ key, managerId, now = Date.now() }) {
  const db = getUltimaDb();
  if (!db) return { state: "unknown" };
  const { data: row, error } = await db
    .from("ultima_action_keys")
    .select("result, created_at")
    .eq("manager_id", managerId)
    .eq("key", key)
    .maybeSingle();
  if (error || !row) return { state: "unknown" };
  if (row.result) return { state: "done", result: row.result };
  const age = now - new Date(row.created_at).getTime();
  return age < STALE_CLAIM_MS ? { state: "working" } : { state: "unknown" };
}

/** About one write in a hundred clears keys older than a week. Never throws. */
export async function maybePurgeActionKeys(random = Math.random) {
  if (random() > 0.01) return;
  const db = getUltimaDb();
  if (!db) return;
  try {
    await db.rpc("ultima_purge_action_keys", { p_days: 7 });
  } catch {
    /* best effort */
  }
}
