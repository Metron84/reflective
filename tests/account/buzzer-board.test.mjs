import test from "node:test";
import assert from "node:assert/strict";
import { runAction, describe } from "@/lib/guesser/buzzer/board.js";
import { claimBuzzerRun, findRun } from "@/lib/guesser/buzzer/store.js";
import { ANSWER_MS, ROUND_MS, newBoard } from "@/lib/guesser/buzzer/engine.js";

const DAY = "2026-10-15";
const IDS = ["a", "b", "c", "d", "e"];
const CLUES = {
  a: ["a1", "a2", "a3", "a4"], b: ["b1", "b2", "b3", "b4"], c: ["c1", "c2", "c3", "c4"],
  d: ["d1", "d2", "d3", "d4"], e: ["e1", "e2", "e3", "e4"],
};
const NAMES = { a: "Alpha One", b: "Bravo Two", c: "Charlie Three", d: "Delta Four", e: "Echo Five" };

function memoryStore() {
  const rows = [];
  let n = 0;
  const copy = (r) => (r ? { id: r.id, userId: r.userId, board: JSON.parse(JSON.stringify(r.board)) } : null);
  return {
    rows,
    async findByUser(userId, day) { return copy(rows.find((r) => r.userId === userId && r.day === day)); },
    async findBySession(hash, day) { return copy(rows.find((r) => r.hash === hash && r.day === day && !r.userId)); },
    async create({ userId, hash, day, board }) {
      const row = { id: ++n, userId: userId ?? null, hash: userId ? null : hash, day, board: JSON.parse(JSON.stringify(board)) };
      rows.push(row);
      return copy(row);
    },
    async save(run, board) {
      const row = rows.find((r) => r.id === run.id);
      if ((row.board.rev ?? 0) !== (run.board.rev ?? 0)) return false;
      row.board = { ...JSON.parse(JSON.stringify(board)), rev: (run.board.rev ?? 0) + 1 };
      return true;
    },
    async attachToUser(run, userId) {
      const row = rows.find((r) => r.id === run.id);
      if (!row || row.userId) return false;
      row.userId = userId; row.hash = null;
      return true;
    },
  };
}

function deps(store, clock, who = { userId: null, hash: "h1" }) {
  return {
    store, ...who, day: DAY, now: () => clock.t, ids: IDS, number: 3,
    cluesFor: (id) => CLUES[id], nameFor: (id) => NAMES[id],
    resolveText: (t) => {
      const k = t.trim().toLowerCase();
      if (k === "silva") return { type: "ambiguous", options: ["a", "b"] };
      const hit = Object.entries(NAMES).find(([, name]) => name.toLowerCase() === k || name.toLowerCase().split(" ")[0] === k);
      return hit ? { type: "one", personId: hit[0] } : { type: "none" };
    },
    personExists: (id) => id in NAMES,
  };
}

const T0 = 5_000_000;

test("before starting there is no run and the player sees the intro", async () => {
  const store = memoryStore();
  const res = await runAction({ action: "state" }, deps(store, { t: T0 }));
  assert.equal(res.body.status, "intro");
  assert.equal(res.body.current, null);
  assert.equal(store.rows.length, 0);
});

test("starting shows only clue 1, and never the answer or person ids", async () => {
  const store = memoryStore();
  const res = await runAction({ action: "start" }, deps(store, { t: T0 }));
  assert.equal(res.body.status, "live");
  assert.deepEqual(res.body.current.clues, ["a1"]);
  const text = JSON.stringify(res.body);
  assert.ok(!text.includes("Alpha One"));
  assert.ok(!/"pid"|"personId"/.test(text));
  assert.ok(!text.includes("a2"));
});

test("later clues arrive on the server's clock, whatever the client says", async () => {
  const store = memoryStore();
  const clock = { t: T0 };
  await runAction({ action: "start" }, deps(store, clock));
  clock.t = T0 + 9900;
  assert.deepEqual((await runAction({ action: "state" }, deps(store, clock))).body.current.clues, ["a1"]);
  clock.t = T0 + 10000;
  assert.deepEqual((await runAction({ action: "state" }, deps(store, clock))).body.current.clues, ["a1", "a2"]);
  clock.t = T0 + 30000;
  assert.equal((await runAction({ action: "state" }, deps(store, clock))).body.current.clues.length, 4);
  // A client claiming a different time in the body changes nothing.
  const res = await runAction({ action: "state", body: { elapsedMs: 99999, now: 1 } }, deps(store, { t: T0 + 100 }));
  assert.deepEqual(res.body.current.clues, ["a1"]);
});

test("buzz freezes, a correct answer scores the frozen value, and the answer is then revealed", async () => {
  const store = memoryStore();
  const clock = { t: T0 };
  await runAction({ action: "start" }, deps(store, clock));
  clock.t = T0 + 12000;
  const buzzed = await runAction({ action: "buzz" }, deps(store, clock));
  assert.equal(buzzed.body.outcome, "frozen");
  assert.equal(buzzed.body.current.frozen, true);
  assert.equal(buzzed.body.current.value, 3);
  clock.t = T0 + 22000; // typed slowly
  const res = await runAction({ action: "answer", body: { personId: "a" } }, deps(store, clock));
  assert.equal(res.body.outcome, "correct");
  assert.equal(res.body.points, 3);
  assert.equal(res.body.score, 3);
  assert.equal(res.body.players[0].name, "Alpha One");
  assert.equal(res.body.status, "between");
  assert.equal(res.body.index, 2);
});

test("a wrong answer resumes the clock, locks the player out and reveals nothing", async () => {
  const store = memoryStore();
  const clock = { t: T0 };
  await runAction({ action: "start" }, deps(store, clock));
  clock.t = T0 + 2000;
  await runAction({ action: "buzz" }, deps(store, clock));
  clock.t = T0 + 5000;
  const wrong = await runAction({ action: "answer", body: { personId: "b" } }, deps(store, clock));
  assert.equal(wrong.body.outcome, "wrong");
  assert.equal(wrong.body.points, 0);
  assert.equal(wrong.body.current.lockedOut, true);
  assert.equal(wrong.body.current.frozen, false);
  assert.ok(!JSON.stringify(wrong.body).includes("Alpha One"));
  const again = await runAction({ action: "buzz" }, deps(store, clock));
  assert.equal(again.body.outcome, "locked-out");
});

test("unclear typed text does not use up the guess", async () => {
  const store = memoryStore();
  const clock = { t: T0 };
  await runAction({ action: "start" }, deps(store, clock));
  await runAction({ action: "buzz" }, deps(store, { t: T0 + 1000 }));
  const none = await runAction({ action: "answer", body: { text: "zzz" } }, deps(store, { t: T0 + 2000 }));
  assert.equal(none.body.outcome, "unknown");
  assert.equal(none.body.current.frozen, true);
  const amb = await runAction({ action: "answer", body: { text: "Silva" } }, deps(store, { t: T0 + 2500 }));
  assert.equal(amb.body.outcome, "ambiguous");
  assert.equal(amb.body.current.lockedOut, false);
  const ok = await runAction({ action: "answer", body: { text: "Alpha" } }, deps(store, { t: T0 + 3000 }));
  assert.equal(ok.body.outcome, "correct");
});

test("typing too slowly counts as the wrong guess, checked by the server", async () => {
  const store = memoryStore();
  await runAction({ action: "start" }, deps(store, { t: T0 }));
  await runAction({ action: "buzz" }, deps(store, { t: T0 + 1000 }));
  const late = await runAction({ action: "answer", body: { personId: "a" } }, deps(store, { t: T0 + 1000 + ANSWER_MS + 5000 }));
  assert.equal(late.body.outcome, "late");
  assert.equal(late.body.current.lockedOut, true);
  assert.equal(late.body.score, 0);
});

test("a round nobody answers closes after the final window and reveals the name", async () => {
  const store = memoryStore();
  await runAction({ action: "start" }, deps(store, { t: T0 }));
  const res = await runAction({ action: "state" }, deps(store, { t: T0 + ROUND_MS + 1 }));
  assert.equal(res.body.players[0].state, "done");
  assert.equal(res.body.players[0].points, 0);
  assert.equal(res.body.players[0].name, "Alpha One");
  assert.equal(res.body.status, "between");
});

test("a full board of five completes", async () => {
  const store = memoryStore();
  const clock = { t: T0 };
  let last;
  for (let i = 0; i < 5; i += 1) {
    await runAction({ action: "start" }, deps(store, clock));
    clock.t += 500;
    await runAction({ action: "buzz" }, deps(store, clock));
    clock.t += 300;
    last = await runAction({ action: "answer", body: { personId: IDS[i] } }, deps(store, clock));
    clock.t += 1000;
  }
  assert.equal(last.body.status, "complete");
  assert.equal(last.body.score, 20);
  assert.equal(last.body.maxScore, 20);
});

test("a stale save loses the race and the request is retried against the new state", async () => {
  const store = memoryStore();
  await runAction({ action: "start" }, deps(store, { t: T0 }));
  const realSave = store.save.bind(store);
  let first = true;
  store.save = async (run, board) => {
    if (first) { first = false; await realSave(run, board); return false; } // someone else saved first
    return realSave(run, board);
  };
  const res = await runAction({ action: "buzz" }, deps(store, { t: T0 + 1000 }));
  assert.equal(res.status, 200);
  assert.equal(res.body.current.frozen, true);
});

test("a member with a signed-out board from this browser carries it on", async () => {
  const store = memoryStore();
  await runAction({ action: "start" }, deps(store, { t: T0 }, { userId: null, hash: "h1" }));
  const found = await findRun(store, { userId: "u1", hash: "h1", day: DAY });
  assert.equal(found.claimed, true);
  assert.equal(found.run.userId, "u1");
  assert.equal(store.rows[0].userId, "u1");
});

test("claim moves a signed-out board to the member, and never replaces one they already have", async () => {
  const store = memoryStore();
  await runAction({ action: "start" }, deps(store, { t: T0 }, { userId: null, hash: "h1" }));
  const claimed = await claimBuzzerRun(store, { userId: "u1", hash: "h1", day: DAY });
  assert.equal(claimed.claimed, true);
  assert.equal(store.rows[0].userId, "u1");

  const store2 = memoryStore();
  await runAction({ action: "start" }, deps(store2, { t: T0 }, { userId: "u2", hash: null }));
  await runAction({ action: "start" }, deps(store2, { t: T0 }, { userId: null, hash: "h9" }));
  const blocked = await claimBuzzerRun(store2, { userId: "u2", hash: "h9", day: DAY });
  assert.equal(blocked.claimed, false);
  assert.equal(blocked.reason, "has-board");
  assert.equal(store2.rows.filter((r) => r.userId === "u2").length, 1);
});

test("claim with nothing to claim is a quiet no-op", async () => {
  const store = memoryStore();
  assert.equal((await claimBuzzerRun(store, { userId: "u1", hash: null, day: DAY })).claimed, false);
  assert.equal((await claimBuzzerRun(store, { userId: "u1", hash: "none", day: DAY })).reason, "no-board");
});

test("describe never includes clues past the unlocked count", () => {
  const board = newBoard();
  board.players[0] = { ...board.players[0], st: "live", t0: 0, pz: 0 };
  const view = describe(board, { ids: IDS, now: 4000, day: DAY, number: 1, cluesFor: (id) => CLUES[id], nameFor: (id) => NAMES[id], hasRun: true });
  assert.deepEqual(view.current.clues, ["a1"]);
});
