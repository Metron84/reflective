import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeQueueDb } from "./helpers/queue-db.mjs";

const known = ["p1", "p2", "p3", "p4"];
let h;
let db;
let user = { id: "u1" };
let manager = { id: "m1" };

function fresh(queues = {}) {
  h = makeQueueDb({ known, queues });
  db = h.db;
}
fresh();

mock.module("next/server", {
  namedExports: { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
});
mock.module("@/lib/auth/session", { namedExports: { getSessionUser: async () => user } });
mock.module("@/lib/ultima/server/db", {
  namedExports: { getManagerForUser: async () => manager, getUltimaDb: () => db },
});

const { POST } = await import("../../app/api/ultima/draft/queue/route.js");
const post = (body) => POST({ json: async () => body });

test("the queue saves server side in the lobby, in order, for the manager", async () => {
  fresh();
  const res = await post({ player_ids: ["p3", "p1", "p2"], base_ids: [] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, saved: 3 });
  assert.deepEqual(h.queueOf("m1"), ["p3", "p1", "p2"]);
});

test("the queue route never looks at the draft state, so it works in the lobby", async () => {
  fresh();
  await post({ player_ids: ["p1"], base_ids: [] });
  assert.equal(db.log.some((q) => q.table === "ultima_draft_state"), false);
});

test("reorder and an explicit clear are saves of the new list", async () => {
  fresh({ m1: ["p1", "p2"] });
  await post({ player_ids: ["p2", "p1"], base_ids: ["p1", "p2"] });
  assert.deepEqual(h.queueOf("m1"), ["p2", "p1"]);
  const res = await post({ player_ids: [], base_ids: ["p2", "p1"] });
  assert.deepEqual(res.body, { ok: true, saved: 0 });
  assert.deepEqual(h.queueOf("m1"), []);
});

test("repeats, junk and unknown players are dropped", async () => {
  fresh();
  const res = await post({ player_ids: ["p1", "p1", 7, "", null, "ghost", "p4"], base_ids: [] });
  assert.equal(res.status, 200);
  assert.deepEqual(h.queueOf("m1"), ["p1", "p4"]);
});

test("a failed save says so instead of pretending", async () => {
  fresh({ m1: ["p1"] });
  h.state.failNext = true;
  const res = await post({ player_ids: ["p2"], base_ids: ["p1"] });
  assert.equal(res.status, 503);
  assert.equal(res.body.message, "The queue did not save. Try again.");
});

test("signed out and unseated visitors cannot save a queue", async () => {
  fresh();
  user = null;
  assert.equal((await post({ player_ids: ["p1"], base_ids: [] })).status, 401);
  user = { id: "u1" };
  manager = null;
  assert.equal((await post({ player_ids: ["p1"], base_ids: [] })).status, 403);
  manager = { id: "m1" };
  assert.equal(db.log.some((q) => q.op === "rpc"), false);
});
