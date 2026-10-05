import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { shouldRefreshSession } from "../../lib/auth/refresh-policy.js";
import { accessTokenFromCookies } from "../../lib/auth/cookie-token.js";
import {
  COOKIE_NAME, SUPABASE_URL, authNetworkCalls, calls, installFakeFetch, resetCalls, sessionCookie,
} from "./helpers/auth-env.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
installFakeFetch();

let renderCookies = [];
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => renderCookies }),
    headers: async () => new Headers({ host: "www.thereflectivefootball.com" }),
  },
});

const { NextRequest } = await import("next/server");
const { middleware } = await import("../../middleware.js");
const { getSessionResult, getVerifiedUser } = await import("../../lib/auth/session.js");

const DOC = { "sec-fetch-dest": "document", accept: "text/html" };
const PREFETCH = { "next-router-prefetch": "1", rsc: "1" };

function req(path, headers, cookie) {
  const h = new Headers({ host: "www.thereflectivefootball.com", ...headers });
  if (cookie) h.set("cookie", `${cookie.name}=${cookie.value}`);
  return new NextRequest(`https://www.thereflectivefootball.com${path}`, { headers: h });
}

/** The cookie header a page render receives after middleware ran. */
function forwardedCookies(response) {
  const header = response.headers.get("x-middleware-request-cookie") ?? "";
  return header.split("; ").filter(Boolean).map((pair) => {
    const i = pair.indexOf("=");
    return { name: pair.slice(0, i), value: pair.slice(i + 1) };
  });
}

// Warm the JWKS cache once so the counts below are refresh and user calls only.
{
  const warm = await sessionCookie({ stale: false });
  await middleware(req("/ultima/trades", DOC, warm));
  renderCookies = [warm];
  await getSessionResult();
}

test("valid token: 0 Auth calls for a document load, a prefetch, an RSC click and an API call", async () => {
  const cookie = await sessionCookie({ stale: false });
  for (const [path, headers] of [
    ["/ultima/trades", DOC],
    ["/ultima/trades", PREFETCH],
    ["/ultima/trades", { rsc: "1" }],
    ["/api/ultima/draft/state", { accept: "application/json" }],
  ]) {
    resetCalls();
    await middleware(req(path, headers, cookie));
    assert.deepEqual(authNetworkCalls(), [], `${path} ${JSON.stringify(headers)}`);
  }
  resetCalls();
  renderCookies = [cookie];
  const { user, error } = await getSessionResult();
  assert.equal(user?.id, "u1");
  assert.equal(error, null);
  assert.deepEqual(authNetworkCalls(), []);
});

test("stale token, document load of /ultima/trades: exactly 1 Auth call, and the render sees the user", async () => {
  const cookie = await sessionCookie({ stale: true });
  resetCalls();
  const res = await middleware(req("/ultima/trades", DOC, cookie));
  assert.deepEqual(authNetworkCalls(), ["POST /auth/v1/token"]);

  renderCookies = forwardedCookies(res);
  const { user, error } = await getSessionResult();
  assert.equal(user?.id, "u1");
  assert.equal(error, null);
  assert.equal(authNetworkCalls().length, 1, "the render added no Auth call");
  assert.ok(res.headers.getSetCookie().some((c) => c.startsWith(COOKIE_NAME)), "browser gets the new session");
});

test("stale token, client navigation (RSC, not prefetch): refreshes once and lands signed in", async () => {
  const cookie = await sessionCookie({ stale: true });
  resetCalls();
  const res = await middleware(req("/ultima/trades", { rsc: "1" }, cookie));
  assert.equal(authNetworkCalls().length, 1);
  renderCookies = forwardedCookies(res);
  assert.equal((await getSessionResult()).user?.id, "u1");
  assert.equal(authNetworkCalls().length, 1);
});

test("stale token: 0 Auth calls for prefetch, /sw.js, manifests, _next/data and static files", async () => {
  const cookie = await sessionCookie({ stale: true });
  for (const [path, headers] of [
    ["/ultima/trades", PREFETCH],
    ["/ultima/trades", { purpose: "prefetch" }],
    ["/sw.js", {}],
    ["/manifest.webmanifest", {}],
    ["/ultima/manifest.webmanifest", {}],
    ["/_next/data/build/ultima/trades.json", { accept: "application/json" }],
    ["/_next/static/chunks/app.js", {}],
    ["/brand/trf-crest-transparent.png", {}],
  ]) {
    resetCalls();
    await middleware(req(path, headers, cookie));
    assert.deepEqual(calls, [], `${path} ${JSON.stringify(headers)}`);
  }
});

test("stale token in a render with no middleware: 0 Auth calls, reported as an error, never signed out", async () => {
  renderCookies = [await sessionCookie({ stale: true })];
  resetCalls();
  const { user, error } = await getSessionResult();
  assert.equal(user, null);
  assert.ok(error, "expired token is an auth error, not a plain signed-out visitor");
  assert.deepEqual(authNetworkCalls(), []);
});

test("no session cookie is a plain signed-out visitor with no error", async () => {
  renderCookies = [];
  resetCalls();
  const { user, error } = await getSessionResult();
  assert.equal(user, null);
  assert.equal(error, null);
  assert.deepEqual(calls, []);
});

test("a 429 on refresh: one attempt, cookies untouched, render unavailable, never signed out", async () => {
  installFakeFetch({ refreshStatus: 429 });
  try {
    const cookie = await sessionCookie({ stale: true });
    resetCalls();
    const res = await middleware(req("/ultima/trades", DOC, cookie));
    assert.equal(authNetworkCalls().length, 1, "no retry");
    assert.deepEqual(res.headers.getSetCookie(), [], "the browser keeps its session");
    renderCookies = forwardedCookies(res);
    assert.deepEqual(renderCookies, [{ name: cookie.name, value: cookie.value }]);
    const { user, error } = await getSessionResult();
    assert.equal(user, null);
    assert.ok(error, "unavailable, not signed out");
    assert.equal(authNetworkCalls().length, 1, "the render did not retry");
  } finally {
    installFakeFetch();
  }
});

test("a rejected refresh token (400) is a real sign-out", async () => {
  installFakeFetch({ refreshStatus: 400 });
  try {
    const cookie = await sessionCookie({ stale: true });
    resetCalls();
    const res = await middleware(req("/ultima/trades", DOC, cookie));
    assert.equal(authNetworkCalls().length, 1);
    renderCookies = forwardedCookies(res);
    const { user, error } = await getSessionResult();
    assert.equal(user, null);
    assert.equal(error, null, "plain signed-out visitor");
  } finally {
    installFakeFetch();
  }
});

test("a write confirms with getUser: one /user call, no refresh", async () => {
  renderCookies = [await sessionCookie({ stale: false })];
  resetCalls();
  const { user, error } = await getVerifiedUser();
  assert.equal(user?.id, "u1");
  assert.equal(error, null);
  assert.deepEqual(authNetworkCalls(), ["GET /auth/v1/user"]);
});

test("refresh policy", () => {
  const h = (o) => new Headers(o);
  assert.equal(shouldRefreshSession("/ultima/trades", h({ "sec-fetch-dest": "document" })), true);
  assert.equal(shouldRefreshSession("/ultima/trades", h({ rsc: "1" })), true);
  assert.equal(shouldRefreshSession("/api/ultima/chat", h({})), true);
  assert.equal(shouldRefreshSession("/ultima/trades", h({ rsc: "1", "next-router-prefetch": "1" })), false);
  assert.equal(shouldRefreshSession("/ultima/trades", h({ "sec-purpose": "prefetch", accept: "text/html" })), false);
  assert.equal(shouldRefreshSession("/api/ultima/chat", h({ purpose: "prefetch" })), false);
  assert.equal(shouldRefreshSession("/sw.js", h({ accept: "text/html" })), false);
  assert.equal(shouldRefreshSession("/_next/data/x/y.json", h({})), false);
  assert.equal(shouldRefreshSession("/logo.svg", h({ accept: "text/html" })), false);
  assert.equal(shouldRefreshSession("/ultima/trades", h({})), false);
});

test("cookie token reader handles chunks and bad input", async () => {
  const c = await sessionCookie({ stale: false });
  const half = Math.floor(c.value.length / 2);
  const chunks = [
    { name: `${COOKIE_NAME}.0`, value: c.value.slice(0, half) },
    { name: `${COOKIE_NAME}.1`, value: c.value.slice(half) },
  ];
  assert.equal(accessTokenFromCookies(chunks, SUPABASE_URL), accessTokenFromCookies([c], SUPABASE_URL));
  assert.ok(accessTokenFromCookies([c], SUPABASE_URL));
  assert.equal(accessTokenFromCookies([{ name: COOKIE_NAME, value: "base64-@@@" }], SUPABASE_URL), null);
  assert.equal(accessTokenFromCookies([], SUPABASE_URL), null);
});
