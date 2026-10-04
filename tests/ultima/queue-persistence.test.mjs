import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { makeQueueDb } from "./helpers/queue-db.mjs";
import { planQueueSave } from "../../lib/ultima/queue-guard.js";

const known = ["p1", "p2", "p3", "p4"];
let h;
let user = { id: "u1" };
let seasonManager = { id: "season-m" };
let practiceManager = { id: "practice-m" };

function fresh(queues = {}) {
  h = makeQueueDb({ known, queues });
}
fresh();

mock.module("next/server", {
  namedExports: { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
});
mock.module("@/lib/auth/session", { namedExports: { getSessionUser: async () => user } });
mock.module("@/lib/ultima/server/db", {
  namedExports: { getManagerForUser: async () => seasonManager, getUltimaDb: () => h.db },
});
mock.module("@/lib/ultima/server/practice", {
  namedExports: {
    getPracticeManager: async () => practiceManager,
    getPracticeRoom: async () => ({ competition_id: "practice-comp" }),
    normalizeRoomCode: (c) => c,
  },
});

const season = await import("../../app/api/ultima/draft/queue/route.js");
const practice = await import("../../app/api/ultima/practice/queue/route.js");
const saveSeason = (body) => season.POST({ json: async () => body });
const savePractice = (body) => practice.POST({ json: async () => ({ code: "ABCD", ...body }) });

test("a save from a stale tab returns QUEUE_CONFLICT and leaves the longer queue intact", async () => {
  fresh({ "season-m": ["p1", "p2", "p3"] });
  // The stale tab loaded ["p1"] before another device added two more.
  const res = await saveSeason({ player_ids: ["p1", "p4"], base_ids: ["p1"] });
  assert.equal(res.status, 409);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, "QUEUE_CONFLICT");
  assert.deepEqual(res.body.queue.map((q) => q.player_id), ["p1", "p2", "p3"]);
  assert.deepEqual(h.queueOf("season-m"), ["p1", "p2", "p3"]);
});

test("a save with no baseIds is refused and writes nothing", async () => {
  fresh({ "season-m": ["p1", "p2"] });
  const res = await saveSeason({ player_ids: [] });
  assert.equal(res.status, 400);
  assert.equal((await saveSeason({ base_ids: [] })).status, 400);
  assert.deepEqual(h.queueOf("season-m"), ["p1", "p2"]);
  assert.equal(h.db.log.some((q) => q.op === "rpc"), false);
});

test("a failed insert leaves the previous queue unchanged", async () => {
  fresh({ "season-m": ["p1", "p2"] });
  h.state.failNext = true;
  const res = await saveSeason({ player_ids: ["p3"], base_ids: ["p1", "p2"] });
  assert.equal(res.status, 503);
  assert.deepEqual(h.queueOf("season-m"), ["p1", "p2"]);
  // The route never deletes or inserts rows itself.
  assert.deepEqual(h.state.directWrites, []);
});

test("no save fires before the saved queue has loaded", () => {
  assert.equal(planQueueSave(undefined, ["p1"]), null);
  assert.equal(planQueueSave(null, []), null);
  // Loaded: a normal save carries the loaded queue as its base.
  assert.deepEqual(planQueueSave([{ player_id: "p1" }], ["p1", "p2"]), {
    player_ids: ["p1", "p2"],
    base_ids: ["p1"],
  });
});

test("an empty list is only sent when the user cleared it", () => {
  const loaded = [{ player_id: "p1" }];
  assert.equal(planQueueSave(loaded, []), null);
  assert.deepEqual(planQueueSave(loaded, [], { cleared: true }), { player_ids: [], base_ids: ["p1"] });
});

test("season and practice queues never overwrite each other", async () => {
  fresh({ "season-m": ["p1", "p2"], "practice-m": ["p3"] });
  assert.equal((await savePractice({ player_ids: ["p4"], base_ids: ["p3"] })).status, 200);
  assert.deepEqual(h.queueOf("season-m"), ["p1", "p2"]);
  assert.deepEqual(h.queueOf("practice-m"), ["p4"]);
  assert.equal((await saveSeason({ player_ids: ["p2"], base_ids: ["p1", "p2"] })).status, 200);
  assert.deepEqual(h.queueOf("season-m"), ["p2"]);
  assert.deepEqual(h.queueOf("practice-m"), ["p4"]);
  // A season tab holding the practice queue as its base is a conflict, not an overwrite.
  const res = await saveSeason({ player_ids: ["p4"], base_ids: ["p4"] });
  assert.equal(res.status, 409);
  assert.deepEqual(h.queueOf("season-m"), ["p2"]);
});

test("a manager cannot read another manager's queue", async () => {
  fresh({ "season-m": ["p1"], "other-m": ["p2", "p3"] });
  const GET = season.GET;
  const res = await GET({ url: "http://x/api/ultima/draft/queue?manager_id=other-m" });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.queue.map((q) => q.player_id), ["p1"]);
  const read = h.db.log.find((q) => q.table === "ultima_draft_queues" && q.op === "select");
  assert.deepEqual(read.filters.find((f) => f[0] === "eq" && f[1] === "manager_id"), ["eq", "manager_id", "season-m"]);
});
