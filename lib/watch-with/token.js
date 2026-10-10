import { createHmac, timingSafeEqual } from "node:crypto";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function signFanToken(email, club, secret, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ email: String(email).toLowerCase(), club, exp: now + WEEK_MS }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function readFanToken(token, secret, now = Date.now()) {
  if (!secret || typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.email || !data?.club || !data?.exp || data.exp < now) return null;
    return { email: String(data.email).toLowerCase(), club: String(data.club) };
  } catch {
    return null;
  }
}
