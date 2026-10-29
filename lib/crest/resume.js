/**
 * Compact ballot for the sign-in hop. sessionStorage is the source on the
 * same origin. This encoding is only for the-crest → TRF handoff.
 *
 * Never use Buffer encodings named "base64url". Phone Next polyfills often
 * expose Buffer and throw on that name. btoa/atob, or Buffer "base64".
 */

import { liveStake } from "./stakes.js";

const FC_REGIONS = ["England", "Italy", "Spain", "Germany", "France", "Rest of the World"];

const FLAGS = {
  Netherlands: "🇳🇱",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Greece: "🇬🇷",
  Croatia: "🇭🇷",
  Czechia: "🇨🇿",
  Turkey: "🇹🇷",
  Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  Monaco: "🇲🇨",
};

/**
 * @param {{clubs?: object[], regions?: object[]}|null|undefined} fc
 */
export function packFc(fc) {
  if (!fc || !Array.isArray(fc.clubs) || !fc.clubs.length) return null;
  return {
    clubs: fc.clubs.map((club) => [club.slug, club.region, club.country, Number(club.percentage)]),
    regions: (fc.regions || []).map((row) => [
      row.region,
      Number(row.percentage),
      row.label,
      (row.ranked || []).map((club) => club.slug),
    ]),
  };
}

/**
 * Packed results from the-crest. Each club is [slug, region, country, percentage].
 *
 * @param {unknown} packed
 * @returns {{clubs: object[], regions: object[], tops: Record<string, object|null>}|null}
 */
export function unpackFc(packed) {
  if (!packed || typeof packed !== "object" || !Array.isArray(packed.clubs)) return null;
  const clubs = [];
  for (const row of packed.clubs) {
    if (!Array.isArray(row) || row.length < 4) return null;
    const [slug, region, country, percentage] = row;
    const pct = Number(percentage);
    if (typeof slug !== "string" || !FC_REGIONS.includes(region) || typeof country !== "string" || !Number.isFinite(pct)) {
      return null;
    }
    clubs.push({
      slug,
      name: slug,
      region,
      country,
      flag: FLAGS[country] || "",
      percentage: pct,
      color: null,
      league: "",
    });
  }
  const bySlug = new Map(clubs.map((club) => [club.slug, club]));
  const regions = [];
  for (const row of packed.regions || []) {
    if (!Array.isArray(row) || row.length < 4) continue;
    const [region, percentage, label, slugs] = row;
    if (!FC_REGIONS.includes(region) || !Array.isArray(slugs)) continue;
    const ranked = slugs.map((slug) => bySlug.get(slug)).filter(Boolean);
    if (!ranked.length) continue;
    regions.push({
      region,
      percentage: Number(percentage),
      label: typeof label === "string" ? label : region,
      top: ranked[0],
      ranked,
    });
  }
  const tops = {};
  for (const region of FC_REGIONS) {
    tops[region] = regions.find((row) => row.region === region)?.top || null;
  }
  return { clubs, regions, tops };
}

/**
 * @param {{answers: {cardId: number, value: 1|0|-1}[], stake?: string|null, scope?: string|null, fc?: object|null}} ballot
 */
export function encodeResume(ballot) {
  const payload = {
    a: ballot.answers.map((row) => [row.cardId, row.value]),
    s: ballot.stake || null,
    g: ballot.scope || null,
  };
  const packed = packFc(ballot.fc);
  if (packed) payload.f = packed;
  return toB64(JSON.stringify(payload));
}

/**
 * @param {string} token
 * @returns {{answers: {cardId: number, value: 1|0|-1}[], stake: string|null, scope: string|null, fc: object|null}}
 */
export function decodeResume(token) {
  const raw = JSON.parse(fromB64(token));
  if (!Array.isArray(raw.a)) throw new Error("Bad resume.");
  return {
    answers: raw.a.map(([cardId, value]) => ({ cardId, value })),
    stake: liveStake(raw.s),
    scope: raw.g || null,
    fc: unpackFc(raw.f),
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
