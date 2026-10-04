import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeFakeDb } from "./helpers/fake-db.mjs";

const known = new Set(["p1", "p2", "p3", "p4"]);
let db;
let user = { id: "u1" };
let manager = { id: "m1" };

function freshDb({ failInsert = false } = {}) {
  db = makeFakeDb((q) => {
    if (q.table === "ultima_players") {
      const ids = q.filters.find((f) => f[0] === "in")?.[2] ?? [];
      return { data: ids.filter((id) => known.has(id)).map((id) => ({ id })), error: null };
    }
    if (q.table === "ultima_draft_queues" && q.op === "insert" && failInsert) {
      return { data: null, error: { message: "boom" } };
    }
    return { data: [], error: null };
  });
}
freshDb();

mock.module("next/server", {
  namedExports: { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
});
mock.module("@/lib/auth/session", { namedExports: { getSessionUser: async () => user } });
mock.module("@/lib/ultima/server/db", {
  namedExports: { getManagerForUser: async () => manager, getUltimaDb: () => db },
});

const { POST } = await import("../../app/api/ultima/draft/queue/route.js");
const post = (body) => POST({ json: async () => body });

const inserted = () => db.log.find((q) => q.table === "ultima_draft_queues" && q.op === "insert")?.payload ?? [];

test("the queue saves server side in the lobby, in order, for the manager", async () => {
  freshDb();
  user = { id: "u1" };
  manager = { id: "m1" };
  const res = await post({ player_ids: ["p3", "p1", "p2"] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, saved: 3 });
  assert.deepEqual(
    inserted().map((r) => [r.manager_id, r.player_id, r.position]),
    [["m1", "p3", 1], ["m1", "p1", 2], ["m1", "p2", 3]],
  );
  const cleared = db.log.find((q) => q.table === "ultima_draft_queues" && q.op === "delete");
  assert.ok(cleared, "the old queue is replaced");
});

test("the queue route never looks at the draft state, so it works in the lobby", async () => {
  freshDb();
  await post({ player_ids: ["p1"] });
  assert.equal(db.log.some((q) => q.table === "ultima_draft_state"), false);
});

test("reorder and remove are saves of the new list", async () => {
  freshDb();
  await post({ player_ids: ["p2", "p1"] });
  assert.deepEqual(inserted().map((r) => r.player_id), ["p2", "p1"]);
  freshDb();
  const res = await post({ player_ids: [] });
  assert.deepEqual(res.body, { ok: true, saved: 0 });
  assert.equal(inserted().length, 0);
});

test("repeats, junk and unknown players are dropped", async () => {
  freshDb();
  const res = await post({ player_ids: ["p1", "p1", 7, "", null, "ghost", "p4"] });
  assert.equal(res.status, 200);
  assert.deepEqual(inserted().map((r) => r.player_id), ["p1", "p4"]);
});

test("a failed save says so instead of pretending", async () => {
  freshDb({ failInsert: true });
  const res = await post({ player_ids: ["p1"] });
  assert.equal(res.status, 503);
  assert.equal(res.body.message, "The queue did not save. Try again.");
});

test("signed out and unseated visitors cannot save a queue", async () => {
  freshDb();
  user = null;
  assert.equal((await post({ player_ids: ["p1"] })).status, 401);
  user = { id: "u1" };
  manager = null;
  assert.equal((await post({ player_ids: ["p1"] })).status, 403);
  assert.equal(db.log.some((q) => q.op === "insert"), false);
});
