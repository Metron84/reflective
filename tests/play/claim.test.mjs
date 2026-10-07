import test from "node:test";
import assert from "node:assert/strict";
import { claimSession, CLAIM_WINDOW_MS } from "@/lib/play/claim.js";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SID = "33333333-3333-4333-8333-333333333333";
const DONE = "2026-10-07T10:00:00.000Z";
const NOW = Date.parse(DONE) + 60_000;

const state = (answers) => ({
  phase: "finished",
  answers,
  answered: answers.length,
  score: answers.reduce((n, a) => n + a.pointsChange, 0),
});
const row = (answers, extra = {}) => ({
  id: SID, state: state(answers), version: 9, completed_at: DONE, claimed_by: null, ...extra,
});
const A = (pointsChange) => ({ correct: pointsChange > 0, pointsChange });

function fakeClient(result) {
  const calls = { rpc: [], updates: [] };
  const chain = (patch) => ({ eq: () => chain(patch), is: async () => { calls.updates.push(patch); return {}; } });
  return {
    calls,
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return result(args); },
    from: (t) => { assert.equal(t, "fan_quiz_sessions"); return { update: (patch) => chain(patch) }; },
  };
}
const echo = (userId, already = false) => (a) => ({
  data: [{ out_score: a.p_score, out_answered: a.p_answered, out_correct: a.p_correct,
    out_incorrect: a.p_incorrect, out_counted: true, out_already_claimed: already, out_user_id: userId }],
});

test("claims with values read from the session row", async () => {
  const c = fakeClient(echo(ME));
  const r = await claimSession(c, row([A(300), A(-200), A(100)]), ME, NOW);
  assert.equal(r.status, 200);
  assert.deepEqual(c.calls.rpc[0], {
    name: "fan_quiz_claim",
    args: { p_user: ME, p_session: SID, p_score: 200, p_answered: 3, p_correct: 2, p_incorrect: 1, p_completed: DONE },
  });
  assert.equal(r.saved.counted, true);
  assert.equal(c.calls.updates.length, 1);
  assert.equal(c.calls.updates[0].claimed_by, ME);
});

test("a negative score is saved as is", async () => {
  const c = fakeClient(echo(ME));
  const r = await claimSession(c, row([A(-500)]), ME, NOW);
  assert.equal(r.status, 200);
  assert.equal(c.calls.rpc[0].args.p_score, -500);
});

test("an unfinished game cannot be saved", async () => {
  const c = fakeClient(echo(ME));
  const r = await claimSession(c, row([A(100)], { completed_at: null }), ME, NOW);
  assert.equal(r.status, 409);
  assert.equal(c.calls.rpc.length, 0);
});

test("a game with no answers cannot be saved", async () => {
  const c = fakeClient(echo(ME));
  assert.equal((await claimSession(c, row([]), ME, NOW)).status, 409);
  assert.equal(c.calls.rpc.length, 0);
});

test("a game claimed by someone else is refused before the rpc", async () => {
  const c = fakeClient(echo(OTHER, true));
  const r = await claimSession(c, row([A(100)], { claimed_by: OTHER }), ME, NOW);
  assert.equal(r.status, 409);
  assert.equal(c.calls.rpc.length, 0);
});

test("if the rpc reports another owner, the claim is refused", async () => {
  const c = fakeClient(echo(OTHER, true));
  const r = await claimSession(c, row([A(100)]), ME, NOW);
  assert.equal(r.status, 409);
  assert.equal(c.calls.updates.length, 0);
});

test("a replay by the same member returns the saved result without re-marking", async () => {
  const c = fakeClient(echo(ME, true));
  const r = await claimSession(c, row([A(100)], { claimed_by: ME }), ME, NOW + CLAIM_WINDOW_MS * 5);
  assert.equal(r.status, 200);
  assert.equal(r.saved.alreadySaved, true);
  assert.equal(c.calls.updates.length, 0);
});

test("an old unclaimed game is too old to save", async () => {
  const c = fakeClient(echo(ME));
  const r = await claimSession(c, row([A(100)]), ME, Date.parse(DONE) + CLAIM_WINDOW_MS + 1);
  assert.equal(r.status, 410);
  assert.equal(c.calls.rpc.length, 0);
});

test("an rpc error returns 500", async () => {
  const c = fakeClient(() => ({ data: null, error: { message: "x" } }));
  assert.equal((await claimSession(c, row([A(100)]), ME, NOW)).status, 500);
});
