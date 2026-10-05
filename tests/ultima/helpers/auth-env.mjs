// Fake Supabase Auth for the refresh tests: signs ES256 JWTs, serves a JWKS,
// answers /token refreshes, and logs every request that leaves the app.
import { stringToBase64URL } from "@supabase/ssr";

export const SUPABASE_URL = "https://testproj.supabase.co";
export const COOKIE_NAME = "sb-testproj-auth-token";

const enc = new TextEncoder();
const b64u = (bytes) => Buffer.from(bytes).toString("base64url");

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicJwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1", alg: "ES256", use: "sig" };

export async function signJwt({ sub = "u1", expiresInSeconds }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT", kid: "k1" })));
  const payload = b64u(
    enc.encode(
      JSON.stringify({ sub, aud: "authenticated", role: "authenticated", email: "u@example.com", iat: now - 10, exp: now + expiresInSeconds }),
    ),
  );
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64u(new Uint8Array(sig))}`;
}

const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "u@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

export async function sessionCookie({ stale }) {
  const access_token = await signJwt({ expiresInSeconds: stale ? -600 : 3600 });
  const expires_at = Math.floor(Date.now() / 1000) + (stale ? -600 : 3600);
  const session = { access_token, refresh_token: "r1", token_type: "bearer", expires_in: 3600, expires_at, user };
  return { name: COOKIE_NAME, value: `base64-${stringToBase64URL(JSON.stringify(session))}` };
}

export const calls = [];

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function installFakeFetch({ refreshStatus = 200 } = {}) {
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.pathname === "/auth/v1/.well-known/jwks.json") return json({ keys: [publicJwk] });
    if (url.pathname === "/auth/v1/token") {
      if (refreshStatus !== 200) return json({ code: refreshStatus === 429 ? "over_request_rate_limit" : "refresh_token_not_found", message: "Request failed" }, refreshStatus);
      const access_token = await signJwt({ expiresInSeconds: 3600 });
      return json({ access_token, refresh_token: "r2", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
    }
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname.startsWith("/rest/v1/")) return json({ welcome_completed: true });
    return json({}, 404);
  };
}

export const authNetworkCalls = () => calls.filter((c) => /\/auth\/v1\/(token|user)/.test(c));
export const resetCalls = () => { calls.length = 0; };
