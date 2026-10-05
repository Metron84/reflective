import { makeFakeDb } from "./fake-db.mjs";

/**
 * A fake db with queue storage that behaves like ultima_set_queue: compare to the
 * base, then replace in one step, or change nothing. `failNext` makes the next
 * rpc fail the way a rolled-back transaction would.
 */
export function makeQueueDb({ known = [], queues = {} } = {}) {
  const store = new Map(Object.entries(queues).map(([id, ids]) => [id, [...ids]]));
  const state = { failNext: false, directWrites: [] };
  const knownSet = new Set(known);

  const db = makeFakeDb((q) => {
    if (q.table === "ultima_players") {
      const ids = q.filters.find((f) => f[0] === "in")?.[2] ?? [];
      return { data: ids.filter((id) => knownSet.has(id)).map((id) => ({ id })), error: null };
    }
    if (q.table === "ultima_draft_queues") {
      if (q.op === "select") {
        const managerId = q.filters.find((f) => f[0] === "eq" && f[1] === "manager_id")?.[2];
        const ids = store.get(managerId) ?? [];
        return { data: ids.map((player_id, i) => ({ player_id, position: i + 1 })), error: null };
      }
      state.directWrites.push(q);
      return { data: null, error: { message: "queue tables are written through the rpc only" } };
    }
    if (q.table === "rpc:ultima_set_queue") {
      const { p_manager_id: m, p_player_ids: next, p_base_ids: base } = q.payload;
      if (state.failNext) {
        state.failNext = false;
        return { data: null, error: { message: "boom" } };
      }
      const current = store.get(m) ?? [];
      if (JSON.stringify(current) !== JSON.stringify(base)) {
        return { data: { ok: false, code: "QUEUE_CONFLICT", queue: [...current] }, error: null };
      }
      store.set(m, [...next]);
      return { data: { ok: true, saved: next.length }, error: null };
    }
    return { data: [], error: null };
  });

  return { db, store, state, queueOf: (m) => store.get(m) ?? [] };
}
