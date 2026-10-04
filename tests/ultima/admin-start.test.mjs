import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { has, makeFakeDb } from "./helpers/fake-db.mjs";

// Who is signed in, and what the database says, for each test.
const world = {
  user: null,
  isAdminProfile: false,
  draftState: "lobby",
  scheduledAt: null,
  db: null,
};

const startDraftCalls = [];

function resetWorld(overrides = {}) {
  Object.assign(world, { user: null, isAdminProfile: false, draftState: "lobby", scheduledAt: null }, overrides);
  startDraftCalls.length = 0;
  world.db = makeFakeDb((q) => {
    if (q.table === "profiles") return { data: { is_admin: world.isAdminProfile }, error: null };
    if (q.table === "ultima_draft_state") {
      return { data: { state: world.draftState, scheduled_at: world.scheduledAt }, error: null };
    }
    if (q.table === "ultima_competition") return { data: { id: "c1", timer_seconds: 60 }, error: null };
    return { data: [], error: null };
  });
}

mock.module("next/server", {
  namedExports: {
    NextResponse: {
      json: (body, init = {}) => ({ body, status: init.status ?? 200 }),
    },
  },
});
mock.module("@/lib/auth/session", {
  namedExports: { getSessionUser: async () => world.user, getProfile: async () => null },
});
mock.module("@/lib/supabase", {
  namedExports: { getServiceClient: () => world.db },
});
mock.module("@/lib/ultima/server/draft", {
  namedExports: {
    startDraft: async (...args) => {
      startDraftCalls.push(args);
      return { ok: true, order: ["m1", "m2"] };
    },
    pauseDraft: async () => ({ ok: true }),
    resumeDraft: async () => ({ ok: true }),
    loadDraftContext: async () => null,
    setDraftTimer: async () => ({ ok: true }),
    executePick: async () => ({ ok: true }),
  },
});
for (const spec of [
  "@/lib/ultima/server/scoring-run",
  "@/lib/ultima/server/players",
  "@/lib/ultima/server/bootstrap",
  "@/lib/ultima/server/events",
]) {
  mock.module(spec, {
    namedExports: {
      recomputeGameweekScores: async () => ({}),
      syncPlayerPool: async () => ({ ok: true }),
      syncAllPlayersFromProvider: async () => [],
      bootstrapSampleGameweek: async () => ({ ok: false }),
      getCurrentGameweek: async () => null,
      publishUltimaEvent: () => {},
      subscribeUltimaEvents: () => () => {},
    },
  });
}

const savedEnv = process.env.ULTIMA_COMMISSIONER_USER_IDS;
process.env.ULTIMA_COMMISSIONER_USER_IDS = "commissioner-user";

const { POST } = await import("../../app/api/ultima/admin/route.js");

const post = (body) => POST({ json: async () => body });

test("start route: a manager who is not the commissioner is rejected", async () => {
  resetWorld({ user: { id: "just-a-manager" } });
  const res = await post({ action: "start_draft" });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "NOT_COMMISSIONER");
  assert.equal(startDraftCalls.length, 0, "startDraft never ran");
});

test("start route: a signed-out visitor is rejected", async () => {
  resetWorld({ user: null });
  const res = await post({ action: "start_draft" });
  assert.equal(res.status, 401);
  assert.equal(startDraftCalls.length, 0);
});

test("start route: the UI is not trusted, any action from a non-commissioner is rejected", async () => {
  resetWorld({ user: { id: "just-a-manager" } });
  for (const action of ["start_draft", "pause_draft", "sync_pool", "schedule_draft"]) {
    const res = await post({ action, league: "pl", scheduled_at: "2026-10-04T16:00" });
    assert.equal(res.status, 403, action);
  }
  assert.equal(startDraftCalls.length, 0);
});

test("start route: the commissioner from the env list can start", async () => {
  resetWorld({ user: { id: "commissioner-user" } });
  const res = await post({ action: "start_draft" });
  assert.equal(res.status, 200);
  assert.equal(startDraftCalls.length, 1);
});

test("start route: a site admin (profiles.is_admin) can start", async () => {
  resetWorld({ user: { id: "site-admin" }, isAdminProfile: true });
  const res = await post({ action: "start_draft" });
  assert.equal(res.status, 200);
  assert.equal(startDraftCalls.length, 1);
});

test("start works before the scheduled time: there is no time lock", async () => {
  const inAnHour = new Date(Date.now() + 3_600_000).toISOString();
  resetWorld({ user: { id: "commissioner-user" }, scheduledAt: inAnHour });
  const res = await post({ action: "start_draft" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(startDraftCalls.length, 1);
});

test("start works long after the scheduled time too", async () => {
  const anHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  resetWorld({ user: { id: "commissioner-user" }, scheduledAt: anHourAgo });
  const res = await post({ action: "start_draft" });
  assert.equal(res.status, 200);
  assert.equal(startDraftCalls.length, 1);
});

test("start never redraws a draft that is already running, paused or done", async () => {
  for (const draftState of ["live", "paused", "complete"]) {
    resetWorld({ user: { id: "commissioner-user" }, draftState });
    const res = await post({ action: "start_draft" });
    assert.equal(res.status, 400, draftState);
    assert.equal(res.body.code, "DRAFT_STARTED");
    assert.equal(res.body.message, "The draft has already started.");
    assert.equal(startDraftCalls.length, 0, draftState);
  }
});

test("schedule: 16:00 typed in GST saves 12:00 UTC through the route", async () => {
  resetWorld({ user: { id: "commissioner-user" } });
  const res = await post({ action: "schedule_draft", scheduled_at: "2026-10-04T16:00" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.scheduledAt, "2026-10-04T12:00:00.000Z");
  const write = world.db.log.find((q) => q.table === "ultima_draft_state" && q.op === "update");
  assert.equal(write.payload.scheduled_at, "2026-10-04T12:00:00.000Z");
  assert.ok(has(write, "eq", "competition_id"));
});

test("schedule: junk is rejected and nothing is written", async () => {
  resetWorld({ user: { id: "commissioner-user" } });
  const res = await post({ action: "schedule_draft", scheduled_at: "soon" });
  assert.equal(res.status, 400);
  assert.equal(world.db.log.some((q) => q.table === "ultima_draft_state" && q.op === "update"), false);
});

process.on("exit", () => {
  if (savedEnv === undefined) delete process.env.ULTIMA_COMMISSIONER_USER_IDS;
  else process.env.ULTIMA_COMMISSIONER_USER_IDS = savedEnv;
});
