// Plays a whole five-player buzzer board through the server logic (runAction) with a fake clock and a
// fake `plays` table behind the real store. No network, no wall clock.
import { runAction } from "@/lib/guesser/buzzer/board.js";
import { createStore } from "@/lib/guesser/buzzer/store.js";
import { cluesFor, nameFor, resolveGuessText } from "@/lib/guesser/buzzer/pool.js";
import { getPerson } from "@/lib/guesser/registry.js";
import { ANSWER_GRACE_MS, ANSWER_MS, WINDOW_MS } from "@/lib/guesser/buzzer/engine.js";

export { ANSWER_GRACE_MS, ANSWER_MS, WINDOW_MS };

/** Real people with four real clues each, so clues, names and typed matching are the live ones. */
export const BOARD = ["diego-maradona", "michel-platini", "gary-lineker", "jorge-valdano", "zbigniew-boniek"];
/** Real people who are never on BOARD: safe wrong answers. */
export const WRONGS = ["xavi", "xabi-alonso", "david-villa", "roger-milla", "ngolo-kante", "dante"];

const clone = (v) => JSON.parse(JSON.stringify(v));

/** Just enough of the Supabase query builder for the store: select, insert, update, eq, is. */
export function fakePlaysDb() {
  const rows = [];
  let seq = 0;
  const read = (row, col) => (col === "guesses->>rev" ? String(row.guesses?.rev ?? 0) : row[col]);
  const pick = (row, cols) => Object.fromEntries(cols.split(",").map((c) => c.trim()).map((c) => [c, clone(row[c])]));

  function query(op, payload) {
    const filters = [];
    let cols = "id";
    const matching = () => rows.filter((r) => filters.every((f) => f(r)));
    const exec = () => {
      if (op === "select") return { data: matching().map((r) => pick(r, cols)), error: null };
      if (op === "insert") {
        const row = { id: ++seq, ...clone(payload) };
        rows.push(row);
        return { data: [pick(row, cols)], error: null };
      }
      const hit = matching();
      for (const r of hit) Object.assign(r, clone(payload));
      return { data: hit.map((r) => pick(r, cols)), error: null };
    };
    const q = {
      select(c) { cols = c; return q; },
      eq(c, v) { filters.push((r) => String(read(r, c)) === String(v)); return q; },
      is(c, v) { filters.push((r) => read(r, c) === v); return q; },
      async maybeSingle() { const { data } = exec(); return { data: data[0] ?? null, error: null }; },
      async single() { const { data } = exec(); return { data: data[0], error: null }; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
    };
    return q;
  }

  return {
    rows,
    from() {
      return {
        select: (c) => query("select").select(c),
        insert: (p) => query("insert", p),
        update: (p) => query("update", p),
      };
    },
  };
}

/**
 * One member or signed-out visitor playing one day's board.
 * Times are wall milliseconds on the fake clock. `rawAt(ms)` moves the clock to `ms` of running clock
 * for a player who has not been paused yet; after a wrong answer, use `unlock()`.
 */
export function newGame({ ids = BOARD, day = "2026-10-15", userId = null, hash = "sess-1", db = fakePlaysDb() } = {}) {
  const store = createStore(db);
  const clock = { t: 9_000_000 };
  const g = {
    db,
    ids,
    clock,
    last: null,
    t0: 0,
    async call(action, body = {}) {
      const res = await runAction(
        { action, body },
        {
          store, userId, hash, day, now: () => clock.t, ids, cluesFor, nameFor, number: 94,
          resolveText: resolveGuessText, personExists: (id) => Boolean(getPerson(id)),
        },
      );
      g.last = res.body;
      return res.body;
    },
    state: () => g.call("state"),
    /** Start the next player's clock. */
    async start() {
      g.t0 = clock.t;
      return g.call("start");
    },
    wait(ms) { clock.t += ms; },
    /** Move to `ms` of running clock for the player just started (no earlier pause). */
    rawAt(ms) { clock.t = g.t0 + ms; },
    buzz: () => g.call("buzz"),
    /** Answer after a short typing delay. */
    async answer(body, typing = 400) {
      clock.t += typing;
      return g.call("answer", body);
    },
    answerRight() { return g.answer({ personId: ids[(g.last?.index ?? 1) - 1] }); },
    answerWrong(personId) { return g.answer({ personId }); },
    /** Advance to the moment the buzzer unlocks, plus a little. */
    async unlock(extra = 100) {
      const s = await g.state();
      clock.t += s.current.unlocksInMs + extra;
      return g.state();
    },
    /** Buzz at `raw` ms of running clock and answer right: a straight correct answer. */
    async perfect(raw = 1000) {
      await g.start();
      g.rawAt(raw);
      await g.buzz();
      return g.answerRight();
    },
  };
  return g;
}

/** Plays the rest of the board as perfect 4-point answers, from player number `from` (1 based). */
export async function perfectFrom(g, from) {
  let body = null;
  for (let n = from; n <= 5; n += 1) body = await g.perfect();
  return body;
}

export const pointsOf = (body) => body.players.map((p) => p.points);
