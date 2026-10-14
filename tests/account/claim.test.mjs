import test from "node:test";
import assert from "node:assert/strict";
import { claimAndContinue, runClaims, runStep } from "@/lib/claim/run.js";
import { codemasterStep, crestStep, guesserStep, playStep } from "@/lib/claim/steps.js";
import { claimGuesserGames } from "@/lib/guesser/claim.js";
import { MAX_ATTEMPTS } from "@/lib/guesser/config.js";
import { parseGuesserCookie } from "@/lib/guesser/state.js";
import { signPayload } from "@/lib/signing.js";
import {
  PENDING_KEY,
  PENDING_TTL_MS,
  clearPendingSave,
  readPendingSave,
  writePendingSave,
} from "@/lib/crest/save-client.js";
import { PROGRAMME_COPY } from "@/lib/programme/copy.js";
import { claimHref, programmeSignInHref, resolveContinue } from "@/lib/programme/links.js";

const res = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/* ---- the runner: a failed claim never blocks the redirect ---- */

test("runStep never throws and reports the failure", async () => {
  const r = await runStep({ name: "x", run: async () => { throw new Error("boom"); } });
  assert.deepEqual({ ok: r.ok, claimed: r.claimed, error: r.error }, { ok: false, claimed: false, error: "boom" });
});

test("runStep gives up on a hung claim", async () => {
  const r = await runStep({ name: "slow", run: () => new Promise(() => {}) }, { timeoutMs: 20 });
  assert.equal(r.ok, false);
  assert.match(r.error, /timed out/);
});

test("a failing claim still redirects, once, and the others still run", async () => {
  const ran = [];
  const navigations = [];
  const steps = [
    { name: "a", run: async () => { ran.push("a"); throw new Error("down"); } },
    { name: "b", run: async () => { ran.push("b"); return { claimed: true }; } },
    { name: "c", run: () => { ran.push("c"); throw new Error("sync throw"); } },
  ];
  const results = await claimAndContinue({ steps, to: "/account", navigate: (to) => navigations.push(to) });
  assert.deepEqual(navigations, ["/account"]);
  assert.deepEqual(ran.sort(), ["a", "b", "c"]);
  assert.deepEqual(results.map((r) => r.ok), [false, true, false]);
});

test("a hung claim still redirects after the timeout", async () => {
  const navigations = [];
  await claimAndContinue({
    steps: [{ name: "hang", run: () => new Promise(() => {}) }],
    to: "/account",
    navigate: (to) => navigations.push(to),
    timeoutMs: 20,
  });
  assert.deepEqual(navigations, ["/account"]);
});

test("runClaims with no steps resolves empty", async () => {
  assert.deepEqual(await runClaims([]), []);
});

/* ---- each game's step ---- */

test("play: claimed on 200, nothing to claim on 404, 409 and 410, a failure on 500", async () => {
  const run = (status) => playStep({ fetch: async () => res(status) }).run();
  assert.deepEqual(await run(200), { claimed: true });
  for (const status of [404, 409, 410]) assert.deepEqual(await run(status), { claimed: false });
  await assert.rejects(run(500), /500/);
});

test("play: posts to /api/play/claim with no client score", async () => {
  const calls = [];
  await playStep({ fetch: async (path, init) => { calls.push([path, init]); return res(200); } }).run();
  assert.equal(calls[0][0], "/api/play/claim");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].body, undefined);
});

test("guesser: reports whether any game was claimed", async () => {
  const run = (body, status = 200) => guesserStep({ fetch: async () => res(status, body) }).run();
  assert.deepEqual(await run({ ok: true, claimed: ["world_cup"] }), { claimed: true });
  assert.deepEqual(await run({ ok: true, claimed: [] }), { claimed: false });
  await assert.rejects(run({}, 401), /401/);
});

test("codemaster: sends local progress and keeps the merged result", async () => {
  const local = { version: 1, solved: { p1: { score: 3, hints: 0, attribution: true, solvedAt: 1 } } };
  const merged = { version: 1, solved: { ...local.solved, p2: { score: 1 } } };
  const saved = [];
  const calls = [];
  const step = codemasterStep({
    fetch: async (path, init) => { calls.push([path, JSON.parse(init.body)]); return res(200, { signedIn: true, progress: merged }); },
    load: () => local,
    save: (p) => saved.push(p),
  });
  assert.deepEqual(await step.run(), { claimed: true });
  assert.equal(calls[0][0], "/api/codemaster/progress");
  assert.deepEqual(calls[0][1], { local });
  assert.deepEqual(saved, [merged]);
});

test("codemaster: nothing solved locally means no request", async () => {
  let called = false;
  const step = codemasterStep({
    fetch: async () => { called = true; return res(200); },
    load: () => ({ version: 1, solved: {} }),
    save: () => {},
  });
  assert.deepEqual(await step.run(), { claimed: false });
  assert.equal(called, false);
});

test("codemaster: a failed request is a failed step, local progress untouched", async () => {
  const saved = [];
  const step = codemasterStep({
    fetch: async () => res(500),
    load: () => ({ version: 1, solved: { p1: {} } }),
    save: (p) => saved.push(p),
  });
  await assert.rejects(step.run(), /500/);
  assert.deepEqual(saved, []);
});

test("crest: saves the pending result then clears it", async () => {
  const events = [];
  const step = crestStep({
    read: () => ({ answers: [{ cardId: 1, value: 1 }] }),
    save: async (b) => { events.push(["save", b.answers.length]); return { ok: true }; },
    clear: () => events.push(["clear"]),
  });
  assert.deepEqual(await step.run(), { claimed: true });
  assert.deepEqual(events, [["save", 1], ["clear"]]);
});

test("crest: no pending result is a no-op", async () => {
  let saved = false;
  const step = crestStep({ read: () => null, save: async () => { saved = true; return { ok: true }; }, clear: () => {} });
  assert.deepEqual(await step.run(), { claimed: false });
  assert.equal(saved, false);
});

test("crest: a failed save keeps the pending result for the next try", async () => {
  let cleared = false;
  const step = crestStep({
    read: () => ({ answers: [{ cardId: 1, value: 1 }] }),
    save: async () => ({ ok: false, message: "Could not save." }),
    clear: () => { cleared = true; },
  });
  await assert.rejects(step.run(), /crest save failed/);
  assert.equal(cleared, false);
});

/* ---- guesser claim: today's cookie games into plays under user_id ---- */

const DAY = "2026-10-15";
const solvedGame = { guesses: [{ personId: "p1", name: "A" }], solved: true, attempts: 1, revealedClues: [] };
const lostGame = { guesses: [], solved: false, attempts: MAX_ATTEMPTS, revealedClues: [] };
const openGame = { guesses: [{ personId: "p2", name: "B" }], solved: false, attempts: 2, revealedClues: [] };

function guesserDeps(played = []) {
  const recorded = [];
  return {
    recorded,
    deps: {
      modes: ["world_cup", "premier_league"],
      playedModes: async () => played,
      hydrate: async (mode, game) => ({ ...game, hydrated: mode }),
      record: async (state, mode, game, userId) => { recorded.push({ mode, userId, day: state.day, hydrated: game.hydrated }); },
    },
  };
}

test("guesser claim: finished games are recorded under the member", async () => {
  const { deps, recorded } = guesserDeps();
  const state = { day: DAY, sid: "s", games: { world_cup: solvedGame, premier_league: lostGame } };
  const claimed = await claimGuesserGames({ state, userId: "u1", deps });
  assert.deepEqual(claimed, ["world_cup", "premier_league"]);
  assert.deepEqual(recorded, [
    { mode: "world_cup", userId: "u1", day: DAY, hydrated: "world_cup" },
    { mode: "premier_league", userId: "u1", day: DAY, hydrated: "premier_league" },
  ]);
});

test("guesser claim: unfinished games, modes already played and unknown modes are skipped", async () => {
  const { deps, recorded } = guesserDeps(["premier_league"]);
  const state = { day: DAY, sid: "s", games: { world_cup: openGame, premier_league: solvedGame, made_up: solvedGame } };
  assert.deepEqual(await claimGuesserGames({ state, userId: "u1", deps }), []);
  assert.deepEqual(recorded, []);
});

test("guesser claim: no member or no games records nothing", async () => {
  const { deps, recorded } = guesserDeps();
  assert.deepEqual(await claimGuesserGames({ state: { day: DAY, games: { world_cup: solvedGame } }, userId: null, deps }), []);
  assert.deepEqual(await claimGuesserGames({ state: { day: DAY, games: {} }, userId: "u1", deps }), []);
  assert.deepEqual(recorded, []);
});

test("guesser claim: a cookie from a past day holds nothing to claim", () => {
  const token = signPayload({ day: "2020-01-01", sid: "s", games: { world_cup: solvedGame } });
  const state = parseGuesserCookie(token);
  assert.deepEqual(state.games, {});
});

/* ---- crest pending result lives in localStorage ---- */

function fakeStore() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
}

test("crest pending: written to localStorage so a new tab finds it", () => {
  const local = fakeStore();
  const session = fakeStore();
  globalThis.window = { localStorage: local, sessionStorage: session };
  const ballot = { answers: [{ cardId: 1, value: 1 }], stake: null, scope: null };
  writePendingSave(ballot, 1000);
  assert.ok(local.getItem(PENDING_KEY));
  assert.equal(session.getItem(PENDING_KEY), null);
  assert.deepEqual(readPendingSave(2000).answers, ballot.answers);
  clearPendingSave();
  assert.equal(readPendingSave(2000), null);
});

test("crest pending: falls back to sessionStorage, expires, and clears both", () => {
  const local = fakeStore();
  const session = fakeStore();
  globalThis.window = { localStorage: local, sessionStorage: session };
  session.setItem(PENDING_KEY, JSON.stringify({ answers: [{ cardId: 2, value: -1 }] }));
  assert.equal(readPendingSave(5).answers[0].cardId, 2);

  local.setItem(PENDING_KEY, JSON.stringify({ answers: [{ cardId: 3, value: 1 }], at: 0 }));
  assert.equal(readPendingSave(PENDING_TTL_MS + 1).answers[0].cardId, 2); // local expired, session used
  clearPendingSave();
  assert.equal(local.getItem(PENDING_KEY), null);
  assert.equal(session.getItem(PENDING_KEY), null);
  delete globalThis.window;
});

/* ---- links and copy ---- */

test("sign-up goes through the claim step and lands on /account", () => {
  assert.equal(claimHref(), "/auth/claim?next=%2Faccount");
  assert.equal(programmeSignInHref(), `/signin?next=${encodeURIComponent("/auth/claim?next=%2Faccount")}`);
  assert.equal(programmeSignInHref({ claim: false }), "/signin?next=%2Faccount");
  assert.equal(programmeSignInHref({ claim: false, origin: "https://x.test" }), "https://x.test/signin?next=%2Faccount");
});

test("a game host continues on the main site", () => {
  const main = "https://thereflectivefootball.com";
  assert.equal(resolveContinue("/account", "play.thereflectivefootball.com", main), `${main}/account`);
  assert.equal(resolveContinue("/account", "watchwith.thereflectivefootball.com", main), `${main}/account`);
  assert.equal(resolveContinue("/account", "thereflectivefootball.com", main), "/account");
  assert.equal(resolveContinue("//evil.test", "thereflectivefootball.com", main), "/account");
  assert.equal(resolveContinue(undefined, "thereflectivefootball.com", main), "/account");
});

test("Programme copy is as briefed and has no em-dashes", () => {
  assert.equal(PROGRAMME_COPY.signedOutLine, "Keep this score. Start your Programme, free.");
  assert.equal(PROGRAMME_COPY.signedOutButton, "Start my Programme");
  assert.equal(PROGRAMME_COPY.signedInLine, "Saved to your Programme.");
  assert.equal(PROGRAMME_COPY.signedInButton, "See it in My Programme");
  assert.equal(PROGRAMME_COPY.menuSignedIn, "My Programme");
  assert.equal(PROGRAMME_COPY.menuSignedOut, "Start your Programme");
  for (const text of Object.values(PROGRAMME_COPY)) assert.ok(!/[–—]/.test(text));
});
