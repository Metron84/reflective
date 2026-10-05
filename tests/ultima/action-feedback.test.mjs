import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";
import { makeFakeDb } from "./helpers/fake-db.mjs";
import {
  benchedReceipt,
  captainReceipt,
  offerAcceptedReceipt,
  offerCancelledReceipt,
  offerDeclinedReceipt,
  offerSentReceipt,
  signedReceipt,
  startedReceipt,
  takenLine,
  vetoReceipt,
  xvSavedReceipt,
} from "../../lib/ultima/receipts.js";
import { performAction, UNCERTAIN_LINE } from "../../lib/ultima/action-client.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

test("receipts state what changed in one line and never use an em-dash", () => {
  const lines = [
    signedReceipt({ added: { name: "Saka" }, dropped: { name: "Havertz" } }),
    signedReceipt({ added: { name: "Saka" } }),
    offerSentReceipt({ team: "Pitch Invaders" }),
    offerSentReceipt({ team: "Pitch Invaders", counter: true }),
    offerAcceptedReceipt({ team: "Pitch Invaders" }),
    offerDeclinedReceipt({ team: "Pitch Invaders" }),
    offerCancelledReceipt({ team: "Pitch Invaders" }),
    vetoReceipt({ vetoed: false, votes: 2 }),
    vetoReceipt({ vetoed: true }),
    xvSavedReceipt({ filled: 12 }),
    startedReceipt({ player: { name: "Saka" } }),
    benchedReceipt({ player: { name: "Saka" } }),
    captainReceipt({ player: { name: "Saka" } }),
    takenLine({ takenBy: "Pitch Invaders", takenAt: new Date(Date.now() - 3 * 60_000).toISOString() }),
  ];
  for (const line of lines) {
    assert.ok(line.length > 0 && line.length < 80, line);
    assert.ok(!line.includes("—") && !line.includes("–"), line);
    assert.ok(!line.includes("\n"), line);
  }
  assert.equal(signedReceipt({ added: { name: "Saka" }, dropped: { name: "Havertz" } }), "Signed Saka, released Havertz");
  assert.equal(offerSentReceipt({ team: "Pitch Invaders" }), "Offer sent to Pitch Invaders, expires in 48h");
});

test("a lost race names who took him and when", () => {
  const now = Date.parse("2026-10-05T10:00:00Z");
  assert.equal(takenLine({ takenBy: "Pitch Invaders", takenAt: "2026-10-05T09:57:00Z", now }), "Signed by Pitch Invaders 3 min ago.");
  assert.equal(takenLine({ takenBy: "Pitch Invaders", takenAt: "2026-10-05T09:59:50Z", now }), "Signed by Pitch Invaders just now.");
  assert.equal(takenLine({ takenBy: "Pitch Invaders", takenAt: "2026-10-05T07:00:00Z", now }), "Signed by Pitch Invaders 3h ago.");
  assert.equal(takenLine({ takenBy: "Pitch Invaders", now }), "Signed by Pitch Invaders.");
});

// ---------------------------------------------------------------------------
// Client: one key per tap, status check after the wait, safe resend
// ---------------------------------------------------------------------------

const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
const never = () => new Promise(() => {});
const fast = { giveUpMs: 20, pollMs: 10, pollTries: 3 };

test("client: a confirmed write returns the server's receipt and sends an Idempotency-Key", async () => {
  const seen = [];
  const result = await performAction({
    url: "/api/ultima/market/transaction",
    body: { add_player_id: "a" },
    key: "key-12345678",
    fetchImpl: async (url, init) => {
      seen.push({ url, headers: init.headers });
      return json(200, { ok: true, receipt: "Signed A" });
    },
    ...fast,
  });
  assert.equal(result.ok, true);
  assert.equal(result.body.receipt, "Signed A");
  assert.equal(seen[0].headers["Idempotency-Key"], "key-12345678");
});

test("client: a refusal carries the server's short reason", async () => {
  const result = await performAction({
    url: "/x",
    key: "key-12345678",
    fetchImpl: async () => json(409, { code: "PICK_TAKEN", message: "Signed by Team 2 3 min ago." }),
    ...fast,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "PICK_TAKEN");
  assert.equal(result.message, "Signed by Team 2 3 min ago.");
});

test("client: after the wait it asks the status route instead of showing an error", async () => {
  const calls = [];
  const result = await performAction({
    url: "/api/ultima/trades/propose",
    body: {},
    key: "key-12345678",
    fetchImpl: async (url) => {
      calls.push(url);
      if (url.startsWith("/api/ultima/action-status")) {
        return json(200, { state: "done", status: 200, body: { ok: true, receipt: "Offer sent to Z, expires in 48h" } });
      }
      return never();
    },
    ...fast,
  });
  assert.equal(result.ok, true);
  assert.equal(result.body.receipt, "Offer sent to Z, expires in 48h");
  assert.ok(calls.some((u) => u.includes("action-status?key=key-12345678")));
});

test("client: if the server never saw the key it sends the same key again", async () => {
  const keys = [];
  let sends = 0;
  const result = await performAction({
    url: "/api/ultima/lineup/save",
    body: {},
    key: "key-12345678",
    fetchImpl: async (url, init) => {
      if (url.startsWith("/api/ultima/action-status")) return json(200, { state: "unknown" });
      keys.push(init.headers["Idempotency-Key"]);
      sends += 1;
      return sends === 1 ? never() : json(200, { ok: true, receipt: "XV saved" });
    },
    ...fast,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(keys, ["key-12345678", "key-12345678"]);
});

test("client: a request still running on the server is waited for, not rejected", async () => {
  let polls = 0;
  const result = await performAction({
    url: "/x",
    key: "key-12345678",
    fetchImpl: async (url) => {
      if (url.startsWith("/api/ultima/action-status")) {
        polls += 1;
        return polls < 2
          ? json(200, { state: "working" })
          : json(200, { state: "done", status: 200, body: { ok: true } });
      }
      return never();
    },
    ...fast,
  });
  assert.equal(result.ok, true);
  assert.equal(polls, 2);
});

test("client: when nothing can be confirmed the result is uncertain, never a false failure", async () => {
  const result = await performAction({
    url: "/x",
    key: "key-12345678",
    fetchImpl: async (url) => (url.startsWith("/api/ultima/action-status") ? json(200, { state: "working" }) : never()),
    ...fast,
  });
  assert.equal(result.ok, false);
  assert.equal(result.uncertain, true);
  assert.equal(result.message, UNCERTAIN_LINE);
});

// ---------------------------------------------------------------------------
// Server: a repeated key returns the stored result and writes nothing
// ---------------------------------------------------------------------------

const keyRows = new Map();
const fakeDb = makeFakeDb((q) => {
  if (q.table !== "ultima_action_keys") return { data: null, error: null };
  const eq = Object.fromEntries(q.filters.filter((f) => f[0] === "eq").map((f) => [f[1], f[2]]));
  const id = `${eq.manager_id}:${eq.key}`;
  if (q.op === "insert") {
    const rid = `${q.payload.manager_id}:${q.payload.key}`;
    if (keyRows.has(rid)) return { data: null, error: { code: "23505", message: "duplicate" } };
    keyRows.set(rid, { ...q.payload, result: null, created_at: new Date().toISOString() });
    return { data: null, error: null };
  }
  const row = keyRows.get(id);
  if (q.op === "select") return { data: row ?? null, error: null };
  if (q.op === "update") {
    if (!row) return { data: null, error: null };
    if (eq.created_at && eq.created_at !== row.created_at) return { data: null, error: null };
    Object.assign(row, q.payload);
    return { data: { key: row.key }, error: null };
  }
  if (q.op === "delete") {
    if (row && !row.result) keyRows.delete(id);
    return { data: null, error: null };
  }
  return { data: null, error: null };
});
mock.module("@/lib/ultima/server/db", { namedExports: { getUltimaDb: () => fakeDb } });
const { runWrite } = await import("../../lib/ultima/server/write-route.js");

const reqWith = (key) => ({ headers: { get: (name) => (name === "idempotency-key" ? key : null) } });
const manager = { id: "m1" };
mock.method(console, "log", () => {});

test("server: a repeated key returns the stored result and the write runs once", async () => {
  keyRows.clear();
  let writes = 0;
  const handler = async () => {
    writes += 1;
    return { status: 200, body: { ok: true, receipt: "Signed A, released B" } };
  };
  const first = await runWrite({ route: "market/transaction", request: reqWith("tap-0000001"), manager, handler });
  const second = await runWrite({ route: "market/transaction", request: reqWith("tap-0000001"), manager, handler });
  assert.equal(writes, 1);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(await second.json(), { ok: true, receipt: "Signed A, released B" });
  assert.equal(second.headers.get("Idempotent-Replay"), "true");
});

test("server: a stored refusal replays as the same refusal", async () => {
  keyRows.clear();
  let writes = 0;
  const handler = async () => {
    writes += 1;
    return { status: 409, body: { code: "PICK_TAKEN", message: "Signed by Team 2 3 min ago." } };
  };
  await runWrite({ route: "player/action", request: reqWith("tap-0000002"), manager, handler });
  const again = await runWrite({ route: "player/action", request: reqWith("tap-0000002"), manager, handler });
  assert.equal(writes, 1);
  assert.equal(again.status, 409);
  assert.equal((await again.json()).code, "PICK_TAKEN");
});

test("server: a second tap while the first is running is told to wait, and writes nothing", async () => {
  keyRows.clear();
  let release;
  let writes = 0;
  const slow = () =>
    new Promise((resolve) => {
      writes += 1;
      release = () => resolve({ status: 200, body: { ok: true } });
    });
  const firstRun = runWrite({ route: "trades/accept", request: reqWith("tap-0000003"), manager, handler: slow });
  await new Promise((r) => setTimeout(r, 20));
  const second = await runWrite({ route: "trades/accept", request: reqWith("tap-0000003"), manager, handler: slow });
  assert.equal(second.status, 409);
  assert.equal((await second.json()).code, "IN_PROGRESS");
  release();
  await firstRun;
  assert.equal(writes, 1);
});

test("server: a key used on another route is refused", async () => {
  keyRows.clear();
  const ok = async () => ({ status: 200, body: { ok: true } });
  await runWrite({ route: "trades/accept", request: reqWith("tap-0000004"), manager, handler: ok });
  const other = await runWrite({ route: "trades/decline", request: reqWith("tap-0000004"), manager, handler: ok });
  assert.equal(other.status, 422);
});

test("server: a failure that wrote nothing frees the key for the same tap to try again", async () => {
  keyRows.clear();
  let attempt = 0;
  const handler = async () => {
    attempt += 1;
    return attempt === 1
      ? { status: 503, body: { code: "UNAVAILABLE" } }
      : { status: 200, body: { ok: true } };
  };
  const first = await runWrite({ route: "lineup/save", request: reqWith("tap-0000005"), manager, handler });
  const second = await runWrite({ route: "lineup/save", request: reqWith("tap-0000005"), manager, handler });
  assert.equal(first.status, 503);
  assert.equal(second.status, 200);
  assert.equal(attempt, 2);
});

test("server: a claim abandoned long ago is taken over once", async () => {
  keyRows.clear();
  keyRows.set("m1:tap-0000006", {
    key: "tap-0000006",
    manager_id: "m1",
    route: "lineup/save",
    result: null,
    created_at: new Date(Date.now() - 120_000).toISOString(),
  });
  let writes = 0;
  const res = await runWrite({
    route: "lineup/save",
    request: reqWith("tap-0000006"),
    manager,
    handler: async () => {
      writes += 1;
      return { status: 200, body: { ok: true } };
    },
  });
  assert.equal(res.status, 200);
  assert.equal(writes, 1);
});

test("server: without a key the write still runs and is timed", async () => {
  keyRows.clear();
  const lines = [];
  console.log.mock.mockImplementation((line) => lines.push(String(line)));
  const res = await runWrite({
    route: "lineup/captain",
    request: reqWith(null),
    manager,
    handler: async () => ({ status: 200, body: { ok: true } }),
  });
  assert.equal(res.status, 200);
  assert.equal(keyRows.size, 0);
  assert.ok(lines.some((l) => /\[ultima\/timing\] route=lineup\/captain ms=\d+ status=200/.test(l)), lines.join("|"));
});

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

test("every write route runs through runWrite with its own route name", () => {
  const routes = {
    "app/api/ultima/market/transaction/route.js": "market/transaction",
    "app/api/ultima/trades/propose/route.js": "trades/propose",
    "app/api/ultima/trades/respond/route.js": "trades/",
    "app/api/ultima/lineup/save/route.js": "lineup/save",
    "app/api/ultima/lineup/captain/route.js": "lineup/captain",
    "app/api/ultima/player/action/route.js": "player/action",
  };
  for (const [file, name] of Object.entries(routes)) {
    const src = read(file);
    assert.match(src, /runWrite\(/, file);
    assert.ok(src.includes(name), file);
    assert.match(src, /requireSeatApi\(\{ mutating: true \}\)/, file);
  }
  const status = read("app/api/ultima/action-status/route.js");
  assert.match(status, /requireSeatApi\(\)/);
});

test("captain changes write events that the Hub news and the Log can show", () => {
  const lineup = read("lib/ultima/server/lineup.js");
  assert.match(lineup, /event: "captain_set"/);
  assert.match(lineup, /event: "captain_removed"/);
  const news = read("lib/ultima/server/news.js");
  assert.match(news, /"captain_set"/);
  assert.match(news, /"captain_removed"/);
  assert.match(read("lib/ultima/server/admin.js"), /captain_set: "Captain set"/);
});

test("market signing refusal reads who took him and when", () => {
  const market = read("lib/ultima/server/market.js");
  assert.match(market, /takenLine\(\{ takenBy: result\.taken_by, takenAt: result\.taken_at \}\)/);
});

test("migration 0056: keys table is server only and signing claims the player row", () => {
  const sql = read("supabase/migrations/0056_ultima_action_keys.sql");
  assert.match(sql, /create table if not exists public\.ultima_action_keys/);
  assert.match(sql, /primary key \(manager_id, key\)/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.ultima_action_keys from anon, authenticated/);
  assert.match(sql, /from public\.ultima_players where id = p_add_player_id for update/);
  assert.match(sql, /'taken_at', owner_at/);
});
