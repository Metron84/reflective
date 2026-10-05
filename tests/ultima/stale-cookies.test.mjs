import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { stringToBase64URL } from "@supabase/ssr";
import {
  appendExpiredCookies, authCookieNamesIn, duplicateAuthCookieNames, expiredCookieHeaders,
} from "../../lib/auth/stale-cookies.js";
import {
  COOKIE_NAME, SUPABASE_URL, authNetworkCalls, grants, installFakeFetch, resetCalls, sessionCookie,
} from "./helpers/auth-env.mjs";

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
installFakeFetch({ deadRefreshTokens: ["dead"] });

let renderCookies = [];
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({ getAll: () => renderCookies, set() {} }),
    headers: async () => new Headers({ host: "www.thereflectivefootball.com" }),
  },
});

const { NextRequest } = await import("next/server");
const { middleware } = await import("../../middleware.js");
const { getSessionResult } = await import("../../lib/auth/session.js");
const callback = await import("../../app/auth/callback/route.js");
const signout = await import("../../app/auth/signout/route.js");

const HOST = "www.thereflectivefootball.com";
const DOC = { "sec-fetch-dest": "document", accept: "text/html" };
const header = (...cookies) => cookies.map((c) => `${c.name}=${c.value}`).join("; ");
const req = (path, cookieHeader, headers = {}, method = "GET") =>
  new NextRequest(`https://${HOST}${path}`, {
    method,
    headers: new Headers({ host: HOST, ...headers, ...(cookieHeader ? { cookie: cookieHeader } : {}) }),
  });

const hostOnlyExpiry = (set) => set.filter((c) => c.startsWith(`${COOKIE_NAME}=;`) && !/Domain=/i.test(c));
const sharedExpiry = (set) => set.filter((c) => c.startsWith(`${COOKIE_NAME}=;`) && /Domain=\.thereflectivefootball\.com/i.test(c));
const forwarded = (res) =>
  (res.headers.get("x-middleware-request-cookie") ?? "").split("; ").filter(Boolean).map((p) => {
    const i = p.indexOf("=");
    return { name: p.slice(0, i), value: p.slice(i + 1) };
  });

// warm the JWKS cache
{
  const warm = await sessionCookie({ stale: false });
  await middleware(req("/ultima/trades", header(warm), DOC));
  renderCookies = [warm];
  await getSessionResult();
}

test("cookie helpers: names, duplicates, expiry scopes", () => {
  const h = `a=1; ${COOKIE_NAME}=x; ${COOKIE_NAME}.0=y; ${COOKIE_NAME}=z; ${COOKIE_NAME}-code-verifier=v`;
  assert.deepEqual(authCookieNamesIn(h).sort(), [COOKIE_NAME, `${COOKIE_NAME}.0`].sort());
  assert.deepEqual(duplicateAuthCookieNames(h), [COOKIE_NAME]);
  const both = expiredCookieHeaders([COOKIE_NAME], HOST);
  assert.equal(both.length, 2);
  assert.equal(both.filter((c) => /Domain=/.test(c)).length, 1);
  assert.ok(both.every((c) => /Secure/.test(c) && /Max-Age=0/.test(c)));
  assert.equal(expiredCookieHeaders([COOKIE_NAME], HOST, { scope: "host" }).length, 1);
  const local = expiredCookieHeaders([COOKIE_NAME], "localhost:4343");
  assert.equal(local.length, 1);
  assert.ok(!/Domain=|Secure/.test(local[0]));
});

test("duplicate auth cookies: the host-only copy is expired, the shared one is kept", async () => {
  const stale = await sessionCookie({ stale: true, refreshToken: "old-host-only" });
  const good = await sessionCookie({ stale: false });
  resetCalls();
  const res = await middleware(req("/ultima/trades", header(stale, good), DOC));
  const set = res.headers.getSetCookie();
  assert.equal(hostOnlyExpiry(set).length, 1, "host-only copy expired");
  assert.equal(sharedExpiry(set).length, 0, "shared-domain copy left alone");
  assert.deepEqual(authNetworkCalls(), [], "the live copy is used, no refresh");
});

test("stale host-only refresh token (400): both copies expire, the render is signed out, no retry", async () => {
  const deadCopy = await sessionCookie({ stale: true, refreshToken: "dead" });
  const other = await sessionCookie({ stale: true, refreshToken: "dead" });
  resetCalls();
  const res = await middleware(req("/ultima/trades", header(other, deadCopy), DOC));
  const set = res.headers.getSetCookie();
  assert.equal(authNetworkCalls().length, 1, "one refresh attempt");
  assert.ok(hostOnlyExpiry(set).length >= 1, "host-only copy expired");
  assert.ok(sharedExpiry(set).length >= 1, "shared-domain copy expired");
  renderCookies = forwarded(res);
  const { user, error } = await getSessionResult();
  assert.equal(user, null);
  assert.equal(error, null, "a dead session is signed out, not unavailable");
});

test("callback with a pre-existing dead session: never refreshes it, expires both copies, sets the shared session", async () => {
  const dead = await sessionCookie({ stale: true, refreshToken: "dead" });
  const verifier = { name: `${COOKIE_NAME}-code-verifier`, value: `base64-${stringToBase64URL(JSON.stringify("verifier123"))}` };
  resetCalls();
  const res = await callback.GET(req("/auth/callback?code=abc&next=%2Fultima%2Ftrades", header(dead, verifier)));
  assert.deepEqual(grants, ["pkce"], "only the code exchange, the dead refresh token is never used");
  assert.equal(res.status, 307);
  assert.equal(new URL(res.headers.get("location")).pathname, "/ultima/trades");
  const set = res.headers.getSetCookie();
  assert.ok(set.some((c) => c.startsWith(`${COOKIE_NAME}=base64-`) && /Domain=\.thereflectivefootball\.com/i.test(c)), "new session on the shared domain");
  assert.ok(!set.some((c) => c.startsWith(`${COOKIE_NAME}=base64-`) && !/Domain=/i.test(c)), "no new host-only session");
  assert.equal(hostOnlyExpiry(set).length, 1);
  assert.equal(sharedExpiry(set).length, 1);
});

test("callback: a failed exchange redirects to /signin?error=callback", async () => {
  installFakeFetch({ exchangeStatus: 400 });
  try {
    const verifier = { name: `${COOKIE_NAME}-code-verifier`, value: `base64-${stringToBase64URL(JSON.stringify("verifier123"))}` };
    const res = await callback.GET(req("/auth/callback?code=bad", header(verifier)));
    const loc = new URL(res.headers.get("location"));
    assert.equal(loc.pathname, "/signin");
    assert.equal(loc.searchParams.get("error"), "callback");
  } finally {
    installFakeFetch({ deadRefreshTokens: ["dead"] });
  }
  const none = await callback.GET(req("/auth/callback", ""));
  assert.equal(new URL(none.headers.get("location")).searchParams.get("error"), "callback");
});

test("callback: next cannot leave the site", async () => {
  const verifier = { name: `${COOKIE_NAME}-code-verifier`, value: `base64-${stringToBase64URL(JSON.stringify("verifier123"))}` };
  const res = await callback.GET(req("/auth/callback?code=abc&next=%2F%2Fevil.com", header(verifier)));
  assert.equal(new URL(res.headers.get("location")).host, HOST);
});

test("sign-out expires host-only and shared-domain copies", async () => {
  const cookie = await sessionCookie({ stale: false });
  renderCookies = [cookie];
  const res = await signout.POST(req("/auth/signout", header(cookie), {}, "POST"));
  const set = res.headers.getSetCookie();
  assert.ok(hostOnlyExpiry(set).length >= 1);
  assert.ok(sharedExpiry(set).length >= 1);
});

test("appendExpiredCookies survives a later response.cookies.set only when appended last", async () => {
  const { NextResponse } = await import("next/server");
  const res = NextResponse.next();
  res.cookies.set(COOKIE_NAME, "new", { domain: ".thereflectivefootball.com", path: "/" });
  appendExpiredCookies(res, [COOKIE_NAME], HOST);
  const set = res.headers.getSetCookie();
  assert.equal(set.length, 3);
});
