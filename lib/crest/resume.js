/**
 * Compact ballot for the sign-in hop. sessionStorage is the source on the
 * same origin. This encoding is only for the-crest → TRF handoff.
 *
 * Never use Buffer encodings named "base64url". Phone Next polyfills often
 * expose Buffer and throw on that name. btoa/atob, or Buffer "base64".
 */

/**
 * @param {{answers: {cardId: number, value: 1|0|-1}[], stake?: string|null, scope?: string|null}} ballot
 */
export function encodeResume(ballot) {
  const payload = JSON.stringify({
    a: ballot.answers.map((row) => [row.cardId, row.value]),
    s: ballot.stake || null,
    g: ballot.scope || null,
  });
  return toB64(payload);
}

/**
 * @param {string} token
 * @returns {{answers: {cardId: number, value: 1|0|-1}[], stake: string|null, scope: string|null}}
 */
export function decodeResume(token) {
  const raw = JSON.parse(fromB64(token));
  if (!Array.isArray(raw.a)) throw new Error("Bad resume.");
  return {
    answers: raw.a.map(([cardId, value]) => ({ cardId, value })),
    stake: raw.s || null,
    scope: raw.g || null,
  };
}

function toB64(value) {
  const b64 =
    typeof btoa === "function"
      ? btoa(value)
      : Buffer.from(value, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(token) {
  const pad = token.length % 4 === 0 ? "" : "=".repeat(4 - (token.length % 4));
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob === "function") return atob(b64);
  return Buffer.from(b64, "base64").toString("utf8");
}
