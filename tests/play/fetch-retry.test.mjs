import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NO_CONNECTION, fetchWithRetry } from "../../lib/play/fetch-retry.js";
import { landingControl } from "../../lib/play/browser-check.js";
import { PLAY_PING_PATH, warmBrowserCheck } from "../../lib/play/warm-check.js";

function jsonRes(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => data,
  };
}

function htmlRes(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "text/html" },
    json: async () => {
      throw new Error("not json");
    },
  };
}

test("HTML response retries, then succeeds", async () => {
  let n = 0;
  const result = await fetchWithRetry("/api/play/session", { method: "POST" }, {
    fetchImpl: async (_path, init) => {
      n += 1;
      assert.equal(init.credentials, "same-origin");
      if (n === 1) return htmlRes(403);
      return jsonRes(200, { categories: ["A"] });
    },
    waitMs: 0,
  });
  assert.equal(n, 2);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { categories: ["A"] });
});

test("network error retries, then no connection", async () => {
  let n = 0;
  const result = await fetchWithRetry("/api/play/spin", { method: "POST" }, {
    fetchImpl: async () => {
      n += 1;
      throw new Error("offline");
    },
    waitMs: 0,
  });
  assert.equal(n, 3);
  assert.equal(result.ok, false);
  assert.equal(result.data.error, NO_CONNECTION);
});

test("JSON 400 does not retry", async () => {
  let n = 0;
  const result = await fetchWithRetry("/api/play/answer", { method: "POST" }, {
    fetchImpl: async () => {
      n += 1;
      return jsonRes(400, { error: "That answer is empty." });
    },
    waitMs: 0,
  });
  assert.equal(n, 1);
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.data.error, "That answer is empty.");
});

test("JSON 500 does not retry", async () => {
  let n = 0;
  const result = await fetchWithRetry("/api/play/finish", { method: "POST" }, {
    fetchImpl: async () => {
      n += 1;
      return jsonRes(500, { error: "Could not finish. Start a new game." });
    },
    waitMs: 0,
  });
  assert.equal(n, 1);
  assert.equal(result.ok, false);
  assert.equal(result.status, 500);
  assert.equal(result.data.error, "Could not finish. Start a new game.");
});

test("PlayGame pings once and keeps Play disabled until the check passes", async () => {
  const src = readFileSync(new URL("../../components/play/PlayGame.js", import.meta.url), "utf8");
  assert.equal((src.match(/fetchWithRetry\(PLAY_PING_PATH/g) ?? []).length, 1);
  assert.match(src, /extraRetries:\s*0/);
  assert.match(src, /landingControl\(/);
  assert.equal(landingControl("pending").disabled, true);
  assert.equal(landingControl("pending").label, "Verifying your browser...");
  assert.equal(landingControl("ready").disabled, false);
  assert.equal(landingControl("ready").label, "Play now");

  let n = 0;
  await warmBrowserCheck({
    fetchImpl: async (path, init) => {
      n += 1;
      assert.equal(path, PLAY_PING_PATH);
      assert.equal(init.method, "GET");
      assert.equal(init.credentials, "same-origin");
      return jsonRes(200, { ok: true });
    },
    waitMs: 0,
  });
  assert.equal(n, 1);
});

test("a checkpoint page is not retried", async () => {
  let n = 0;
  const result = await fetchWithRetry("/api/play/answer", { method: "POST" }, {
    fetchImpl: async () => {
      n += 1;
      return {
        ok: true,
        status: 200,
        redirected: true,
        headers: { get: () => "text/html" },
        clone() {
          return this;
        },
        text: async () => "Security Checkpoint verifying your browser",
      };
    },
    waitMs: 0,
    extraRetries: 2,
  });
  assert.equal(n, 1);
  assert.equal(result.ok, false);
  assert.equal(result.data.error, NO_CONNECTION);
  assert.equal(result.debug.kind, "challenge");
  assert.equal(result.debug.attempts, 1);
});
