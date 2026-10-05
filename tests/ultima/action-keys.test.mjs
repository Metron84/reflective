import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { readFileSync } from "node:fs";
import { agoLabel, cardActionReceipt, offerSentReceipt, signReceipt, takenLine, tradeResponseReceipt } from "../../lib/ultima/receipts.js";

// An in-memory ultima_action_keys table behind the Supabase client shape.
const table = new Map();
const rowKey = (m, k) => `${m}:${k}`;

function fakeDb() {
  return {
    from(name) {
      assert.equal(name, "ultima_action_keys");
      const q = { op: "select", payload: null, eq: {} };
      const api = {
        insert(payload) {
          q.op = "insert";
          q.payload = payload;
          return api;
        },
        update(payload) {
          q.op = "update";
          q.payload = payload;
          return api;
        },
        delete() {
          q.op = "delete";
          return api;
        },
        select() {
          return api;
        },
        eq(col, value) {
          q.eq[col] = value;
          return api;
        },
        maybeSingle() {
          return run();
        },
        then(resolve, reject) {
          return run().then(resolve, reject);
        },
      };
      function run() {
        const id = rowKey(q.eq.manager_id ?? q.payload?.manager_id, q.eq.key ?? q.payload?.key);
        if (q.op === "insert") {
          if (table.has(id)) return Promise.resolve({ error: { code: "23505", message: "dup" } });
          table.set(id, { ...q.payload, status: null, result: null });
          return Promise.resolve({ error: null });
        }
        if (q.op === "update") {
          table.set(id, { ...table.get(id), ...q.payload });
          return Promise.resolve({ error: null });
        }
        if (q.op === "delete") {
          table.delete(id);
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ data: table.get(id) ?? null, error: null });
      }
      return api;
    },
  };
}

mock.module("next/server", {
  namedExports: {
    NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) },
  },
});
mock.module("@/lib/supabase", { namedExports: { getServiceClient: () => fakeDb() } });

const { runIdempotent, readActionKeyState } = await import("../../lib/ultima/server/action-keys.js");

const KEY = "tap-0001-abcdef";
const req = (key) => ({ headers: new Headers(key ? { "idempotency-key": key } : {}) });

function capture() {
  const lines = [];
  const original = console.info;
  console.info = (line) => lines.push(String(line));
  return { lines, restore: () => (console.info = original) };
}

test("no key: the write runs and nothing is stored", async () => {
  table.clear();
  let runs = 0;
  const res = await runIdempotent({
    request: req(null),
    route: "lineup/save",
    managerId: "m1",
    handler: async () => (runs += 1, { status: 200, body: { ok: true } }),
  });
  assert.equal(res.status, 200);
  assert.equal(runs, 1);
  assert.equal(table.size, 0);
});

test("a repeated key returns the stored result and writes nothing more", async () => {
  table.clear();
  let runs = 0;
  const handler = async () => (runs += 1, { status: 200, body: { ok: true, receipt: "Signed A, released B" } });
  const first = await runIdempotent({ request: req(KEY), route: "player/action", managerId: "m1", handler });
  const again = await runIdempotent({ request: req(KEY), route: "player/action", managerId: "m1", handler });
  assert.equal(runs, 1);
  assert.deepEqual(again.body, first.body);
  assert.equal(again.headers["Idempotent-Replay"], "true");
});

test("a stored refusal is replayed too", async () => {
  table.clear();
  let runs = 0;
  const handler = async () => (runs += 1, { status: 409, body: { code: "PICK_TAKEN", message: "Ajax FC signed him 3 min ago." } });
  await runIdempotent({ request: req(KEY), route: "player/action", managerId: "m1", handler });
  const again = await runIdempotent({ request: req(KEY), route: "player/action", managerId: "m1", handler });
  assert.equal(runs, 1);
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "PICK_TAKEN");
});

test("the same key from another manager is a different tap", async () => {
  table.clear();
  let runs = 0;
  const handler = async () => (runs += 1, { status: 200, body: { ok: true } });
  await runIdempotent({ request: req(KEY), route: "lineup/save", managerId: "m1", handler });
  await runIdempotent({ request: req(KEY), route: "lineup/save", managerId: "m2", handler });
  assert.equal(runs, 2);
});

test("a second call while the first runs gets 202 PENDING and does not write", async () => {
  table.clear();
  let runs = 0;
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const slow = runIdempotent({
    request: req(KEY),
    route: "trades/propose",
    managerId: "m1",
    handler: async () => {
      runs += 1;
      await gate;
      return { status: 200, body: { ok: true } };
    },
  });
  await new Promise((r) => setTimeout(r, 5));
  const second = await runIdempotent({
    request: req(KEY),
    route: "trades/propose",
    managerId: "m1",
    handler: async () => (runs += 1, { status: 200, body: { ok: true } }),
  });
  assert.equal(second.status, 202);
  assert.equal(second.body.code, "PENDING");
  assert.deepEqual(await readActionKeyState({ managerId: "m1", key: KEY }), { state: "pending" });
  release();
  await slow;
  assert.equal(runs, 1);
  const done = await readActionKeyState({ managerId: "m1", key: KEY });
  assert.equal(done.state, "done");
  assert.equal(done.status, 200);
});

test("a server failure frees the key so the same tap can retry", async () => {
  table.clear();
  let runs = 0;
  const handler = async () => {
    runs += 1;
    return runs === 1 ? { status: 503, body: { code: "UNAVAILABLE" } } : { status: 200, body: { ok: true } };
  };
  const first = await runIdempotent({ request: req(KEY), route: "lineup/captain", managerId: "m1", handler });
  assert.equal(first.status, 503);
  assert.deepEqual(await readActionKeyState({ managerId: "m1", key: KEY }), { state: "unknown" });
  const retry = await runIdempotent({ request: req(KEY), route: "lineup/captain", managerId: "m1", handler });
  assert.equal(retry.status, 200);
  assert.equal(runs, 2);
});

test("a thrown handler frees the key", async () => {
  table.clear();
  await assert.rejects(
    runIdempotent({
      request: req(KEY),
      route: "lineup/save",
      managerId: "m1",
      handler: async () => {
        throw new Error("boom");
      },
    }),
    /boom/,
  );
  assert.equal(table.size, 0);
});

test("a key reused for another route is refused", async () => {
  table.clear();
  const handler = async () => ({ status: 200, body: { ok: true } });
  await runIdempotent({ request: req(KEY), route: "lineup/save", managerId: "m1", handler });
  const other = await runIdempotent({ request: req(KEY), route: "lineup/captain", managerId: "m1", handler });
  assert.equal(other.status, 409);
});

test("a malformed key is a 400 and never reaches the handler", async () => {
  table.clear();
  let runs = 0;
  const res = await runIdempotent({
    request: req("no"),
    route: "lineup/save",
    managerId: "m1",
    handler: async () => (runs += 1, { status: 200, body: {} }),
  });
  assert.equal(res.status, 400);
  assert.equal(runs, 0);
});

test("every write logs route name and ms", async () => {
  table.clear();
  const log = capture();
  try {
    await runIdempotent({ request: req(KEY), route: "market/transaction", managerId: "m1", handler: async () => ({ status: 200, body: {} }) });
  } finally {
    log.restore();
  }
  const line = log.lines.find((l) => l.startsWith("[ultima/timing]"));
  assert.ok(line);
  const parsed = JSON.parse(line.replace("[ultima/timing] ", ""));
  assert.equal(parsed.route, "market/transaction");
  assert.equal(typeof parsed.ms, "number");
  assert.equal(parsed.status, 200);
});

test("status check: a key that never landed is unknown", async () => {
  table.clear();
  assert.deepEqual(await readActionKeyState({ managerId: "m1", key: "never-sent-key" }), { state: "unknown" });
});

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

test("receipts say exactly what changed, one line, no em-dashes", () => {
  const lines = [
    signReceipt({ added: "Saka", dropped: "Rice" }),
    signReceipt({ added: "Saka" }),
    offerSentReceipt({ team: "Ajax FC", hours: 48 }),
    tradeResponseReceipt({ kind: "accept", state: "review" }),
    tradeResponseReceipt({ kind: "cancel" }),
    cardActionReceipt({ action: "captain_on", name: "Haaland" }),
    cardActionReceipt({ action: "xv_out", name: "Haaland" }),
    takenLine({ takenBy: "Ajax FC", takenAt: new Date(Date.now() - 120_000).toISOString() }),
  ];
  assert.equal(lines[0], "Signed Saka, released Rice");
  assert.equal(lines[2], "Offer sent to Ajax FC, expires in 48h");
  assert.equal(lines[5], "Haaland is captain");
  for (const line of lines) {
    assert.ok(!line.includes("—"), line);
    assert.ok(!line.includes("\n"), line);
  }
});

test("agoLabel and takenLine name who and when", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  assert.equal(agoLabel("2026-10-05T11:59:50Z", now), "just now");
  assert.equal(agoLabel("2026-10-05T11:57:00Z", now), "3 min ago");
  assert.equal(agoLabel("2026-10-05T09:00:00Z", now), "3 h ago");
  assert.equal(takenLine({ takenBy: "Ajax FC", takenAt: "2026-10-05T11:57:00Z" }, now), "Ajax FC signed him 3 min ago.");
  assert.equal(takenLine({ takenBy: null, takenAt: null }, now), "Another club signed him first.");
});

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("every write route takes an Idempotency-Key through runIdempotent", () => {
  const routes = {
    "app/api/ultima/market/transaction/route.js": "market/transaction",
    "app/api/ultima/player/action/route.js": "player/action",
    "app/api/ultima/trades/propose/route.js": "trades/propose",
    "app/api/ultima/trades/respond/route.js": "trades/",
    "app/api/ultima/lineup/save/route.js": "lineup/save",
    "app/api/ultima/lineup/captain/route.js": "lineup/captain",
  };
  for (const [file, name] of Object.entries(routes)) {
    const src = read(file);
    assert.match(src, /runIdempotent\(\{/, file);
    assert.ok(src.includes(name), file);
  }
});

test("the trade preview stays unkeyed, it writes nothing", () => {
  const src = read("app/api/ultima/trades/propose/route.js");
  assert.ok(src.indexOf("body?.preview") < src.indexOf("runIdempotent({"));
});

test("captain moves are written to ultima_events and shown in the log", () => {
  const lineup = read("lib/ultima/server/lineup.js");
  assert.match(lineup, /event: "captain_set"/);
  assert.match(lineup, /event: "captain_removed"/);
  const news = read("lib/ultima/server/news.js");
  assert.match(news, /"captain_set"/);
  assert.match(news, /"captain_removed"/);
});

test("migration 0056: keys table with RLS, locked claim, taken_at", () => {
  const sql = read("supabase/migrations/0056_ultima_action_keys.sql");
  assert.match(sql, /create table if not exists public\.ultima_action_keys/);
  assert.match(sql, /primary key \(manager_id, key\)/);
  assert.match(sql, /alter table public\.ultima_action_keys enable row level security/);
  assert.match(sql, /from public\.ultima_players where id = p_add_player_id for update/);
  assert.match(sql, /'taken_at', owner_at/);
});

test("client: the spec timings are 2s slow and 10s give up", async () => {
  const { SLOW_MS, GIVE_UP_MS } = await import("../../lib/ultima/execute-action.js");
  assert.equal(SLOW_MS, 2000);
  assert.equal(GIVE_UP_MS, 10000);
});

// ---------------------------------------------------------------------------
// executeAction: slow, give up, status check
// ---------------------------------------------------------------------------

const { executeAction } = await import("../../lib/ultima/execute-action.js");

const reply = (status, data) => Promise.resolve({ status, json: async () => data });

test("client: a fast answer is returned and never marked slow", async () => {
  let slow = 0;
  const seen = [];
  const out = await executeAction({
    url: "/api/ultima/lineup/save",
    body: { slots: [] },
    key: "tap-fast-0001",
    onSlow: () => (slow += 1),
    slowMs: 30,
    giveUpMs: 100,
    fetchImpl: (url, init) => {
      seen.push(init.headers["Idempotency-Key"]);
      return reply(200, { ok: true, receipt: "Lineup saved" });
    },
  });
  assert.equal(out.status, 200);
  assert.equal(out.data.receipt, "Lineup saved");
  assert.deepEqual(seen, ["tap-fast-0001"]);
  assert.equal(slow, 0);
});

test("client: a slow write flips to slow, then still lands", async () => {
  let slow = 0;
  const out = await executeAction({
    url: "/x",
    body: {},
    key: "tap-slow-0001",
    onSlow: () => (slow += 1),
    slowMs: 10,
    giveUpMs: 200,
    fetchImpl: () => new Promise((resolve) => setTimeout(() => resolve({ status: 200, json: async () => ({ ok: true }) }), 40)),
  });
  assert.equal(slow, 1);
  assert.equal(out.status, 200);
});

test("client: after the give-up time it asks the status route instead of erroring", async () => {
  const calls = [];
  const out = await executeAction({
    url: "/x",
    body: {},
    key: "tap-hang-0001",
    slowMs: 5,
    giveUpMs: 20,
    pollMs: 5,
    fetchImpl: (url) => {
      calls.push(url);
      if (url.startsWith("/api/ultima/action-status")) {
        return reply(200, { state: "done", status: 200, result: { ok: true, receipt: "Offer sent to Ajax FC, expires in 48h" } });
      }
      return new Promise(() => {});
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "/api/ultima/action-status?key=tap-hang-0001");
  assert.equal(out.status, 200);
  assert.equal(out.data.receipt, "Offer sent to Ajax FC, expires in 48h");
});

test("client: pending then done is followed through; unknown means it never landed", async () => {
  let polls = 0;
  const landed = await executeAction({
    url: "/x",
    body: {},
    key: "tap-pend-0001",
    giveUpMs: 10,
    pollMs: 5,
    fetchImpl: (url) => {
      if (!url.startsWith("/api/ultima/action-status")) return new Promise(() => {});
      polls += 1;
      return reply(200, polls < 3 ? { state: "pending" } : { state: "done", status: 200, result: { ok: true } });
    },
  });
  assert.equal(landed.status, 200);
  assert.equal(polls, 3);

  const lost = await executeAction({
    url: "/x",
    body: {},
    key: "tap-lost-0001",
    giveUpMs: 10,
    pollMs: 5,
    fetchImpl: (url) => (url.startsWith("/api/ultima/action-status") ? reply(200, { state: "unknown" }) : new Promise(() => {})),
  });
  assert.deepEqual(lost, { unknown: true });
});

test("client: a dropped connection and a 202 both fall back to the status check", async () => {
  const states = [{ state: "done", status: 409, result: { code: "PICK_TAKEN", message: "Ajax FC signed him 3 min ago." } }];
  const make = (first) => (url) =>
    url.startsWith("/api/ultima/action-status") ? reply(200, states[0]) : first();
  const dropped = await executeAction({
    url: "/x", body: {}, key: "tap-drop-0001", giveUpMs: 50, pollMs: 5,
    fetchImpl: make(() => Promise.reject(new Error("offline"))),
  });
  assert.equal(dropped.status, 409);
  const pending = await executeAction({
    url: "/x", body: {}, key: "tap-202-00001", giveUpMs: 50, pollMs: 5,
    fetchImpl: make(() => reply(202, { code: "PENDING" })),
  });
  assert.equal(pending.data.code, "PICK_TAKEN");
});

test("client: a status route that stays pending ends as stillPending, not an error", async () => {
  const out = await executeAction({
    url: "/x", body: {}, key: "tap-wait-0001", giveUpMs: 5, pollMs: 2, pollTries: 3,
    fetchImpl: (url) => (url.startsWith("/api/ultima/action-status") ? reply(200, { state: "pending" }) : new Promise(() => {})),
  });
  assert.deepEqual(out, { stillPending: true });
});
