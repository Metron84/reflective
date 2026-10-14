import { getServiceClient } from "@/lib/supabase";
import { saltedHash } from "@/lib/signing";
import { isComplete, score } from "./engine";

export const BUZZER_MODE = "buzzer";

export function sidHash(sid) {
  return sid ? saltedHash(sid) : null;
}

/**
 * Server-side run storage on the `plays` table: one row per board, mode "buzzer". The whole run
 * (timestamps included) lives in `guesses`, so a player cannot rewind it by replaying a cookie.
 * A signed-out run is keyed by a hash of the session id, and moves to the member on sign-up.
 *
 * Every method returns plain data. `db` is a Supabase service client, or a fake in tests.
 */
export function createStore(db = getServiceClient()) {
  const cols = "id, user_id, guesses";
  const asRun = (row) => (row ? { id: row.id, userId: row.user_id, board: row.guesses } : null);

  return {
    async findByUser(userId, day) {
      if (!db || !userId) return null;
      const { data } = await db
        .from("plays").select(cols)
        .eq("user_id", userId).eq("puzzle_date", day).eq("mode", BUZZER_MODE)
        .maybeSingle();
      return asRun(data);
    },

    async findBySession(hash, day) {
      if (!db || !hash) return null;
      const { data } = await db
        .from("plays").select(cols)
        .eq("session_hash", hash).eq("puzzle_date", day).eq("mode", BUZZER_MODE)
        .maybeSingle();
      return asRun(data);
    },

    /** Create the run. A concurrent create by the same player returns the row that won. */
    async create({ userId, hash, day, board }) {
      if (!db) return null;
      const row = {
        user_id: userId ?? null,
        session_hash: userId ? null : hash,
        puzzle_date: day,
        mode: BUZZER_MODE,
        guesses: board,
        solved: false,
        attempts: 0,
        score: 0,
      };
      const { data, error } = await db.from("plays").insert(row).select(cols).single();
      if (!error && data) return asRun(data);
      return userId ? this.findByUser(userId, day) : this.findBySession(hash, day);
    },

    /** Save a new board state if nobody else saved since `run` was read. False means it lost the race. */
    async save(run, board) {
      if (!db) return false;
      const next = { ...board, rev: (run.board?.rev ?? 0) + 1 };
      const { data, error } = await db
        .from("plays")
        .update({
          guesses: next,
          solved: isComplete(next),
          attempts: next.players.filter((p) => p.st === "done").length,
          score: score(next),
        })
        .eq("id", run.id)
        .eq("guesses->>rev", String(run.board?.rev ?? 0))
        .select("id");
      return !error && Array.isArray(data) && data.length === 1;
    },

    /** Hand a signed-out run to a member. */
    async attachToUser(run, userId) {
      if (!db) return false;
      const { data, error } = await db
        .from("plays")
        .update({ user_id: userId, session_hash: null })
        .eq("id", run.id)
        .is("user_id", null)
        .select("id");
      return !error && Array.isArray(data) && data.length === 1;
    },
  };
}

/**
 * Find today's run for whoever is playing. A member with no run of their own who has a signed-out
 * run from this browser is given it, so a board started before sign-up carries on.
 *
 * @returns {Promise<{run: object|null, claimed: boolean}>}
 */
export async function findRun(store, { userId, hash, day }) {
  if (userId) {
    const own = await store.findByUser(userId, day);
    if (own) return { run: own, claimed: false };
    const anon = hash ? await store.findBySession(hash, day) : null;
    if (anon && (await store.attachToUser(anon, userId))) {
      return { run: { ...anon, userId }, claimed: true };
    }
    return { run: null, claimed: false };
  }
  return { run: hash ? await store.findBySession(hash, day) : null, claimed: false };
}

/**
 * Claim a signed-out board for a member after sign-up. Never replaces a board the member already
 * has for the day.
 *
 * @returns {Promise<{claimed: boolean, complete?: boolean, reason?: string}>}
 */
export async function claimBuzzerRun(store, { userId, hash, day }) {
  if (!userId || !hash) return { claimed: false, reason: "nothing-to-claim" };
  if (await store.findByUser(userId, day)) return { claimed: false, reason: "has-board" };
  const anon = await store.findBySession(hash, day);
  if (!anon) return { claimed: false, reason: "no-board" };
  if (!(await store.attachToUser(anon, userId))) return { claimed: false, reason: "could-not-attach" };
  return { claimed: true, complete: isComplete(anon.board) };
}
