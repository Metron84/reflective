import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

const QUESTIONS = JSON.parse(readFileSync(new URL("../../data/play/questions.json", import.meta.url), "utf8"));
const SID = "44444444-4444-4444-8444-444444444444";
let row = null;

/** Just enough of the Supabase client for loadSession and saveState. */
const client = {
  from(table) {
    assert.equal(table, "fan_quiz_sessions");
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row ? structuredClone(row) : null }) }) }),
      update: (patch) => ({
        eq: () => ({
          eq: (_col, version) => ({
            select: async () => {
              if (!row || row.version !== version) return { data: [] };
              Object.assign(row, structuredClone(patch));
              return { data: [{ id: row.id }] };
            },
          }),
        }),
      }),
    };
  },
};

// bank.js imports the JSON without an import attribute, which node:test cannot load.
mock.module("@/lib/play/bank.js", { namedExports: { QUESTIONS, answerSeconds: () => 45 } });
mock.module("@/lib/supabase", { namedExports: { getServiceClient: () => client } });

const { applySpin, newState, GRACE_MS } = await import("../../lib/play/game.js");
const { POST } = await import("../../app/api/play/skip/route.js");

const Q = QUESTIONS.find((q) => q.id === "chelsea-100-c1");

/** A session with Q open. `deadlineIn` is ms from now, negative once the timer has run out. */
function openGame({ skipsUsed = 0, deadlineIn = 60_000 } = {}) {
  const spun = applySpin(newState(QUESTIONS), Q, Date.now(), 45);
  spun.pending.deadline = Date.now() + deadlineIn;
  spun.skipsUsed = skipsUsed;
  row = { id: SID, state: spun, version: 3, completed_at: null, claimed_by: null };
}

let n = 0;
function skip() {
  n += 1; // a fresh IP per call keeps the rate limit out of the way
  return POST(
    new NextRequest("https://www.thereflectivefootball.com/api/play/skip", {
      method: "POST",
      headers: { cookie: `fq_sid=${SID}`, "x-forwarded-for": `10.0.0.${n}` },
    }),
  );
}

test("POST /api/play/skip skips an open question for 0 points and reveals the answer", async () => {
  openGame();
  const res = await skip();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.skipped, true);
  assert.equal(body.correct, false);
  assert.equal(body.pointsChange, 0);
  assert.equal(body.score, 0);
  assert.equal(body.answered, 1);
  assert.equal(body.skipsLeft, 1);
  assert.equal(body.answer, Q.answer);
  assert.equal(body.next, "spin");
  assert.equal(row.version, 4);
  assert.equal(row.state.skipsUsed, 1);
  assert.equal(row.state.pending, null);
  assert.ok(row.state.usedCells.includes("Chelsea|100"));
  assert.ok(row.state.served.includes(Q.id));
});

test("the third skip returns 409 and leaves the game untouched", async () => {
  openGame({ skipsUsed: 2 });
  const res = await skip();
  assert.equal(res.status, 409);
  assert.equal((await res.json()).next, "answer");
  assert.equal(row.version, 3);
  assert.equal(row.state.skipsUsed, 2);
  assert.ok(row.state.pending);
});

test("a skip after the timer and grace window have run out returns 409", async () => {
  openGame({ deadlineIn: -(GRACE_MS + 3000) });
  const res = await skip();
  assert.equal(res.status, 409);
  assert.equal((await res.json()).next, "answer");
  assert.equal(row.version, 3);
  assert.equal(row.state.skipsUsed, 0);
  assert.ok(row.state.pending);
});

test("a skip just after the timer, inside the grace window, still goes through", async () => {
  openGame({ deadlineIn: -(GRACE_MS - 1000) });
  const res = await skip();
  assert.equal(res.status, 200);
  assert.equal(row.state.skipsUsed, 1);
});

test("a skip with no open question returns 409", async () => {
  openGame();
  row.state.pending = null;
  row.state.phase = "spin";
  const res = await skip();
  assert.equal(res.status, 409);
});
