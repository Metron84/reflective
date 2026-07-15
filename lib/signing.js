import crypto from "crypto";

function getSecret() {
  const secret = process.env.VOTE_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("VOTE_SECRET must be set in production");
  }
  return "trf-dev-secret-not-for-production";
}

function hmac(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

export function signPayload(obj) {
  const body = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifyPayload(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

// Salted hashes for IP and fingerprint. Raw values are never stored.
export function saltedHash(value) {
  return hmac(`salt:${value}`);
}
