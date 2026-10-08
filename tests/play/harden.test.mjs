import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { connectionDebugLine, fetchWithRetry, NO_CONNECTION } from "../../lib/play/fetch-retry.js";
import { missingQuestion } from "../../lib/play/question-guard.js";
import { playRoute } from "../../lib/play/route-guard.js";
import { installFakeFetch, sessionCookie } from "../ultima/helpers/auth-env.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://testproj.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const { middleware } = await import("../../middleware.js");

function playRequest(path, cookie) {
  const headers = { host: "www.thereflectivefootball.com", accept: "application/json" };
  if (cookie) headers.cookie = `${cookie.name}=${cookie.value}`;
  return new NextRequest(`https://www.thereflectivefootball.com${path}`, { headers });
}

function pageRequest(path, cookie) {
  const headers = {
    host: "www.thereflectivefootball.com",
    accept: "text/html",
    "sec-fetch-dest": "document",
  };
  if (cookie) headers.cookie = `${cookie.name}=${cookie.value}`;
  return new NextRequest(`https://www.thereflectivefootball.com${path}`, { headers });
}

test("a signed-in player who has not finished welcome is not redirected off /api/play", async () => {
  const original = globalThis.fetch;
  installFakeFetch();
  const base = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    if (url.pathname.startsWith("/rest/v1/")) {
      return new Response(JSON.stringify({ welcome_completed: false }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return base(input, init);
  };
  try {
    const cookie = await sessionCookie({ stale: false });
    const page = await middleware(pageRequest("/account", cookie));
    assert.equal(page.status, 307);
    assert.match(page.headers.get("location") ?? "", /\/welcome/);

    const api = await middleware(playRequest("/api/play/answer", cookie));
    assert.equal(api.status, 200);
    assert.equal(api.headers.get("location"), null);
  } finally {
    globalThis.fetch = original;
  }
});

test("a thrown play handler returns JSON 500", async () => {
  const res = await playRoute("answer", () => {
    throw new Error("boom");
  });
  assert.equal(res.status, 500);
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.deepEqual(await res.json(), { error: "server_error" });
});

test("a pending question missing from the bank returns JSON 409", async () => {
  const res = missingQuestion({ pending: { questionId: "not-in-the-bank" } }, []);
  assert.equal(res.status, 409);
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.deepEqual(await res.json(), { error: "question_missing" });
  assert.equal(missingQuestion({ pending: { questionId: "kept" } }, [{ id: "kept" }]), null);
  assert.equal(missingQuestion({}, []), null);
});

test("final failure keeps no connection and reports the challenge page", async () => {
  const html = "<html>  Security   Checkpoint\n verifying your browser  </html>";
  const result = await fetchWithRetry("/api/play/answer", { method: "POST" }, {
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      redirected: true,
      headers: { get: () => "text/html; charset=utf-8" },
      clone() {
        return this;
      },
      text: async () => html,
      json: async () => {
        throw new Error("not json");
      },
    }),
    waitMs: 0,
    extraRetries: 0,
  });
  assert.equal(result.data.error, NO_CONNECTION);
  assert.equal(result.debug.route, "answer");
  assert.equal(result.debug.attempts, 1);
  assert.equal(result.debug.lastStatus, 200);
  assert.equal(result.debug.lastContentType, "text/html");
  assert.equal(result.debug.redirected, true);
  assert.equal(result.debug.kind, "challenge");
  assert.equal(result.debug.body.length <= 100, true);
  assert.match(result.debug.body, /Security Checkpoint/);
  assert.equal(connectionDebugLine(result.debug), "ref answer 200 text/html challenge");
});
