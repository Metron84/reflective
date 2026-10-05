import { NextResponse } from "next/server";
import { getUltimaDb } from "@/lib/ultima/server/db";

const KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;

/** Read the Idempotency-Key header. null: none sent. false: malformed. */
export function readActionKey(request) {
  const raw = request.headers.get("idempotency-key");
  if (raw == null || raw === "") return null;
  return KEY_RE.test(raw) ? raw : false;
}

function logTiming(route, startedAt, status, extra = {}) {
  const ms = Date.now() - startedAt;
  console.info(`[ultima/timing] ${JSON.stringify({ route, ms, status, ...extra })}`);
}

function respond(status, body, headers) {
  return NextResponse.json(body, { status, headers });
}

/**
 * Run one write with an optional Idempotency-Key.
 *
 * With a key: the key is claimed before the write. A repeat of a finished key
 * returns the stored result and writes nothing. A repeat while the first call is
 * still running returns 202 PENDING. A server failure (5xx) frees the key so the
 * same tap can retry. Without a key the write runs as before.
 *
 * handler() returns { status, body }. Every call logs route name and ms.
 */
export async function runIdempotent({ request, route, managerId, handler }) {
  const startedAt = Date.now();
  const key = readActionKey(request);

  if (key === false) {
    logTiming(route, startedAt, 400, { bad_key: true });
    return respond(400, { code: "INVALID", message: "Invalid request." });
  }

  const db = key ? getUltimaDb() : null;
  if (!key || !db || !managerId) {
    const { status, body } = await handler();
    logTiming(route, startedAt, status);
    return respond(status, body);
  }

  const claim = await db.from("ultima_action_keys").insert({ key, manager_id: managerId, route });
  if (claim?.error) {
    if (claim.error.code !== "23505") {
      // Cannot claim: run the write unkeyed rather than block the manager.
      console.error("[ultima/action-keys] claim failed", claim.error.message);
      const { status, body } = await handler();
      logTiming(route, startedAt, status, { keyed: false });
      return respond(status, body);
    }
    const { data: prior } = await db
      .from("ultima_action_keys")
      .select("route, status, result")
      .eq("manager_id", managerId)
      .eq("key", key)
      .maybeSingle();
    if (prior && prior.route !== route) {
      logTiming(route, startedAt, 409, { replay: false });
      return respond(409, { code: "INVALID", message: "That tap was used for something else." });
    }
    if (prior?.result != null) {
      logTiming(route, startedAt, prior.status ?? 200, { replay: true });
      return respond(prior.status ?? 200, prior.result, { "Idempotent-Replay": "true" });
    }
    logTiming(route, startedAt, 202, { replay: true, pending: true });
    return respond(202, { code: "PENDING", message: "Still working on that move." });
  }

  let outcome;
  try {
    outcome = await handler();
  } catch (error) {
    await db.from("ultima_action_keys").delete().eq("manager_id", managerId).eq("key", key);
    logTiming(route, startedAt, 500, { threw: true });
    throw error;
  }

  const { status, body } = outcome;
  if (status >= 500) {
    await db.from("ultima_action_keys").delete().eq("manager_id", managerId).eq("key", key);
  } else {
    const { error } = await db
      .from("ultima_action_keys")
      .update({ status, result: body })
      .eq("manager_id", managerId)
      .eq("key", key);
    if (error) console.error("[ultima/action-keys] store failed", error.message);
  }
  logTiming(route, startedAt, status);
  return respond(status, body);
}

/** State of a key for the status check: unknown (never landed), pending, or done. */
export async function readActionKeyState({ managerId, key }) {
  const db = getUltimaDb();
  if (!db || !managerId || !KEY_RE.test(key ?? "")) return { state: "unknown" };
  const { data } = await db
    .from("ultima_action_keys")
    .select("status, result")
    .eq("manager_id", managerId)
    .eq("key", key)
    .maybeSingle();
  if (!data) return { state: "unknown" };
  if (data.result == null) return { state: "pending" };
  return { state: "done", status: data.status ?? 200, result: data.result };
}
