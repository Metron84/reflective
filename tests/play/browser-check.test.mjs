import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CHECK_AGAIN,
  VERIFY_KEY,
  landingControl,
  pingGate,
  recoverChallenge,
} from "../../lib/play/browser-check.js";

function memory() {
  const bag = new Map();
  return {
    getItem: (key) => (bag.has(key) ? bag.get(key) : null),
    setItem: (key, value) => bag.set(key, String(value)),
    removeItem: (key) => bag.delete(key),
  };
}

const challenge = {
  ok: false,
  status: 0,
  data: { error: "No connection. Check your signal and try again." },
  debug: { kind: "challenge", lastStatus: 200, lastContentType: "text/html", route: "ping" },
};

test("a pending ping disables Play", () => {
  const src = readFileSync(new URL("../../components/play/PlayGame.js", import.meta.url), "utf8");
  assert.match(src, /useState\("pending"\)/);
  assert.match(src, /disabled=\{control\.disabled\}/);
  assert.equal(landingControl("pending").disabled, true);
  assert.equal(landingControl("pending").label, "Verifying your browser...");
});

test("a JSON ping enables Play", () => {
  const store = memory();
  store.setItem(VERIFY_KEY, "1");
  const decision = pingGate({ ok: true, status: 200, data: { ok: true } }, store, 10_000);
  assert.equal(decision.play, true);
  assert.equal(decision.reload, false);
  assert.equal(decision.held, false);
  assert.equal(store.getItem(VERIFY_KEY), null);
  assert.equal(landingControl("ready").disabled, false);
  assert.equal(landingControl("ready").label, "Play now");
});

test("a non-JSON ping reloads once", () => {
  const store = memory();
  const html = {
    ok: false,
    status: 0,
    data: {},
    debug: { lastContentType: "text/html", lastStatus: 200 },
  };
  const decision = pingGate(html, store, 5_000);
  assert.equal(decision.reload, true);
  assert.equal(decision.play, false);
  assert.equal(store.getItem(VERIFY_KEY), "5000");
});

test("a JSON ping that is not ok stays closed", () => {
  const decision = pingGate({ ok: true, status: 200, data: { ok: false } }, memory(), 5_000);
  assert.equal(decision.play, false);
  assert.equal(decision.reload, false);
});

test("a challenge ping reloads once", () => {
  const store = memory();
  const now = 1_000_000;
  const decision = pingGate(challenge, store, now);
  assert.equal(decision.reload, true);
  assert.equal(decision.play, false);
  assert.equal(store.getItem(VERIFY_KEY), String(now));
});

test("a second challenge within 60 seconds does not reload again", () => {
  const store = memory();
  const now = 1_000_000;
  pingGate(challenge, store, now);
  const again = pingGate(challenge, store, now + 59_000);
  assert.equal(again.reload, false);
  assert.equal(again.held, true);
  assert.equal(again.play, false);
  assert.equal(CHECK_AGAIN, "Your browser needs one more check.");
  assert.equal(recoverChallenge(challenge, store, now + 59_000), "hold");

  const later = pingGate(challenge, store, now + 61_000);
  assert.equal(later.reload, true);
});

test("Play resumes a stored session after the check and reloads on a later checkpoint", () => {
  const src = readFileSync(new URL("../../components/play/PlayGame.js", import.meta.url), "utf8");
  assert.match(src, /rememberSession\(/);
  assert.match(src, /rememberedSession\(/);
  assert.match(src, /fetchWithRetry\("\/api\/play\/session", \{ method: "GET" \}/);
  assert.match(src, /window\.location\.reload\(\)/);
  assert.match(src, /Try again/);
  assert.match(src, /if \(!decision\.play\)/);
  assert.match(src, /setScore\(data\.score/);
  assert.match(src, /setAnswered\(data\.answered/);
  assert.match(src, /setStreak\(data\.streak/);
});
