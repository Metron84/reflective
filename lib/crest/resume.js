/**
 * Compact ballot for the sign-in hop. sessionStorage is the source on the
 * same origin. This encoding is only for the-crest → TRF handoff.
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
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64url");
  }
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(token) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(token, "base64url").toString("utf8");
  }
  const pad = token.length % 4 === 0 ? "" : "=".repeat(4 - (token.length % 4));
  return atob(token.replace(/-/g, "+").replace(/_/g, "/") + pad);
}
