import crypto from "crypto";

const MIN_AGE_MS = 3_000;
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — long pitches still pass

function getSecret() {
  const secret = process.env.CONCIERGE_HANDOFF_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[concierge/handoff] CONCIERGE_HANDOFF_SECRET unset — timing gate skipped."
    );
    return null;
  }
  return "trf-handoff-dev-secret-not-for-production";
}

function sign(issuedAt) {
  const secret = getSecret();
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(String(issuedAt))
    .digest("hex");
}

/** @returns {string | null} token `issuedAt.signature` or null if secret missing in prod */
export function issueHandoffTimingToken() {
  const issuedAt = Date.now();
  const signature = sign(issuedAt);
  if (!signature) return null;
  return `${issuedAt}.${signature}`;
}

/**
 * @returns {{ ok: true, skipped?: boolean } | { ok: false, reason: "invalid" | "too-fast" | "expired" }}
 */
export function verifyHandoffTimingToken(token) {
  const secret = getSecret();
  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "invalid" };
  }

  const [issuedRaw, signature] = token.split(".");
  const issuedAt = Number(issuedRaw);
  if (!Number.isFinite(issuedAt) || !signature) {
    return { ok: false, reason: "invalid" };
  }

  const expected = sign(issuedAt);
  if (!expected) return { ok: false, reason: "invalid" };

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  const age = Date.now() - issuedAt;
  if (age < MIN_AGE_MS) return { ok: false, reason: "too-fast" };
  if (age > MAX_AGE_MS) return { ok: false, reason: "expired" };
  return { ok: true };
}
