import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { safeNextPath } from "../../lib/auth/safe-next.js";

let claims = { user: { id: "u1" }, error: null };
let verified = { user: { id: "u1" }, error: null };
let seatResult = { status: "seated", manager: { id: "m1" }, competition: { id: "c1" } };
const calls = { verify: 0, seat: 0 };

mock.module("next/server", {
  namedExports: { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
});
mock.module("next/navigation", { namedExports: { redirect: (to) => { throw new Error(`redirect:${to}`); } } });
mock.module("@/lib/auth/session", {
  namedExports: {
    getSessionResult: async () => claims,
    getVerifiedUser: async () => { calls.verify += 1; return verified; },
    getAuthContext: async () => ({
      user: claims.user,
      profile: { welcome_completed: true },
      isSignedIn: Boolean(claims.user),
      authError: Boolean(claims.error),
    }),
  },
});
mock.module("@/lib/ultima/server/db", {
  namedExports: { lookupSeat: async () => { calls.seat += 1; return seatResult; } },
});

const { requireSeatApi, requireUserApi, requireSeat } = await import("../../lib/ultima/server/requireSeat.js");

function reset() {
  claims = { user: { id: "u1" }, error: null };
  verified = { user: { id: "u1" }, error: null };
  seatResult = { status: "seated", manager: { id: "m1" }, competition: { id: "c1" } };
  calls.verify = 0;
  calls.seat = 0;
}

test("signed out API call is 401, auth that could not be checked is 503", async () => {
  reset();
  claims = { user: null, error: null };
  assert.equal((await requireSeatApi()).response.status, 401);
  claims = { user: null, error: new Error("rate limited") };
  assert.equal((await requireSeatApi()).response.status, 503);
});

test("reads use claims only, writes confirm with getUser", async () => {
  reset();
  assert.equal((await requireSeatApi({ mutating: false })).ok, true);
  assert.equal(calls.verify, 0);
  assert.equal((await requireSeatApi({ mutating: true })).ok, true);
  assert.equal(calls.verify, 1);
});

test("a write is 401 when getUser rejects and 503 when it cannot check", async () => {
  reset();
  verified = { user: null, error: null };
  assert.equal((await requireUserApi({ mutating: true })).response.status, 401);
  verified = { user: null, error: new Error("429") };
  assert.equal((await requireUserApi({ mutating: true })).response.status, 503);
  verified = { user: { id: "someone-else" }, error: null };
  assert.equal((await requireUserApi({ mutating: true })).response.status, 401);
});

test("a failed seat lookup is 503, never 403 no seat", async () => {
  reset();
  seatResult = { status: "unavailable" };
  const res = await requireSeatApi();
  assert.equal(res.response.status, 503);
  assert.equal(res.response.body.message, "Couldn't load your seat. Try again.");
  seatResult = { status: "no-seat", draftState: "complete", competition: { id: "c1" } };
  assert.equal((await requireSeatApi()).response.status, 403);
});

test("page gate: seated passes at any draft status, unavailable never redirects", async () => {
  reset();
  assert.equal((await requireSeat("/ultima/trades")).status, "seated");
  seatResult = { status: "unavailable" };
  assert.equal((await requireSeat("/ultima/trades")).status, "unavailable");
});

test("page gate: signed out goes to sign-in with next", async () => {
  reset();
  claims = { user: null, error: null };
  await assert.rejects(() => requireSeat("/ultima/trades"), /redirect:\/signin\?next=%2Fultima%2Ftrades/);
});

test("page gate: join only in lobby, full once the draft has started", async () => {
  reset();
  seatResult = { status: "no-seat", draftState: "lobby", competition: { id: "c1" } };
  assert.equal((await requireSeat("/ultima/join", { join: true })).status, "can-join");
  for (const draftState of ["live", "paused", "complete", "cancelled"]) {
    seatResult = { status: "no-seat", draftState, competition: { id: "c1" } };
    assert.equal((await requireSeat("/ultima/join", { join: true })).status, "full");
  }
  await assert.rejects(() => requireSeat("/ultima/trades"), /redirect:\/ultima$/);
});

test("safeNextPath keeps same-origin paths and drops the rest", () => {
  assert.equal(safeNextPath("/ultima/trades?x=1"), "/ultima/trades?x=1");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/a\nb", null, undefined, 5]) {
    assert.equal(safeNextPath(bad), "/");
  }
  assert.equal(safeNextPath("//evil.com", "/ultima"), "/ultima");
});

// resolveSeatState: a failed query must never read as "no seat".
const dbReal = await import("../../lib/ultima/server/seat-state.js");

function fakeDb(tables, failures = {}) {
  return {
    from(table) {
      const q = { filters: {} };
      const chain = {
        select: () => chain,
        eq: (k, v) => { q.filters[k] = v; return chain; },
        maybeSingle: async () => {
          if (failures[table] > 0) { failures[table] -= 1; return { data: null, error: new Error("boom") }; }
          const row = (tables[table] ?? []).find((r) => Object.entries(q.filters).every(([k, v]) => r[k] === v));
          return { data: row ?? null, error: null };
        },
      };
      return chain;
    },
  };
}
const tables = () => ({
  ultima_competition: [{ id: "c1", is_active: true, kind: "season" }, { id: "p1", is_active: false, kind: "practice" }],
  ultima_managers: [{ id: "m1", user_id: "u1", is_bot: false, competition_id: "c1" }],
  ultima_draft_state: [{ competition_id: "c1", state: "complete" }],
});

test("seat lookup: seated whatever the draft state", async () => {
  const r = await dbReal.resolveSeatState(fakeDb(tables()), "u1");
  assert.equal(r.status, "seated");
  assert.equal(r.manager.id, "m1");
});

test("seat lookup: no seat reports the draft state", async () => {
  const r = await dbReal.resolveSeatState(fakeDb(tables()), "u2");
  assert.equal(r.status, "no-seat");
  assert.equal(r.draftState, "complete");
  const t = tables();
  t.ultima_draft_state = [];
  assert.equal((await dbReal.resolveSeatState(fakeDb(t), "u2")).draftState, "lobby");
});

test("seat lookup: one failure is retried, two failures are unavailable", async () => {
  assert.equal((await dbReal.resolveSeatState(fakeDb(tables(), { ultima_managers: 1 }), "u1")).status, "seated");
  assert.equal((await dbReal.resolveSeatState(fakeDb(tables(), { ultima_managers: 2 }), "u1")).status, "unavailable");
  assert.equal((await dbReal.resolveSeatState(fakeDb(tables(), { ultima_competition: 2 }), "u1")).status, "unavailable");
});
