import { BINARY_CARD_IDS, CARDS, TOTAL, allowsBoth } from "./cards.js";
import { arrivalSummary } from "./match.js";
import { isStake } from "./stakes.js";
import { CLUBS, CREST_GROUPS } from "./clubs.js";

/**
 * @param {unknown} raw
 * @returns {{answers: {cardId: number, value: 1|0|-1}[], stake: string|null, scope: string|null}|{error: string}}
 */
export function parseBallot(raw) {
  if (!raw || typeof raw !== "object") return { error: "Missing ballot." };
  const answers = Array.isArray(raw.answers) ? raw.answers : null;
  if (!answers || answers.length !== TOTAL) return { error: "Need eighteen answers." };

  const used = new Set();
  const next = [];
  for (const row of answers) {
    if (!row || typeof row !== "object") return { error: "Bad answer." };
    const card = CARDS.find((c) => c.id === row.cardId);
    if (!card || used.has(card.id)) return { error: "Bad card." };
    used.add(card.id);
    const value = row.value;
    if (value !== 1 && value !== -1 && value !== 0) return { error: "Bad swipe." };
    if (value === 0 && !allowsBoth(card) && BINARY_CARD_IDS.includes(card.id)) {
      return { error: "That card is left or right only." };
    }
    next.push({ cardId: card.id, value });
  }
  if (used.size !== TOTAL) return { error: "Need every card." };

  const stake = raw.stake == null || raw.stake === "" ? null : String(raw.stake);
  if (stake && !isStake(stake)) return { error: "Bad chip." };
  const scope = raw.scope == null || raw.scope === "" ? null : String(raw.scope);
  if (scope && !CREST_GROUPS.includes(scope)) return { error: "Bad scope." };

  return { answers: next, stake, scope, fc: normaliseFc(raw.fc) };
}

const BY_SLUG = new Map(CLUBS.map((club) => [club.slug, club]));
const FC_REGIONS = ["England", "Italy", "Spain", "Germany", "France", "Rest of the World"];

/**
 * Fill names and colours from the club list. Country, flag, region and
 * percentage stay as they arrived on the handoff.
 *
 * @param {unknown} fc
 */
export function normaliseFc(fc) {
  if (!fc || typeof fc !== "object" || !Array.isArray(fc.clubs) || !fc.clubs.length) return null;
  const clubs = [];
  for (const row of fc.clubs) {
    if (!row || typeof row.slug !== "string" || !FC_REGIONS.includes(row.region)) return null;
    const percentage = Number(row.percentage);
    if (!Number.isFinite(percentage)) return null;
    const known = BY_SLUG.get(row.slug);
    clubs.push({
      slug: row.slug,
      name: known?.name || row.name || row.slug,
      region: row.region,
      country: typeof row.country === "string" ? row.country : known?.country || "",
      flag: typeof row.flag === "string" ? row.flag : "",
      percentage,
      color: known?.color || row.color || null,
      league: known?.competition || row.league || "",
    });
  }
  const bySlug = new Map(clubs.map((club) => [club.slug, club]));
  const regions = [];
  for (const row of fc.regions || []) {
    if (!row || !FC_REGIONS.includes(row.region)) continue;
    const ranked = (row.ranked || []).map((club) => bySlug.get(club.slug || club)).filter(Boolean);
    if (!ranked.length) continue;
    regions.push({
      region: row.region,
      percentage: Number(row.percentage),
      label: typeof row.label === "string" ? row.label : row.region,
      top: ranked[0],
      ranked,
    });
  }
  if (!regions.length) return null;
  const tops = {};
  for (const region of FC_REGIONS) tops[region] = regions.find((row) => row.region === region)?.top || null;
  return { clubs, regions, tops };
}

/**
 * @param {{answers: {cardId: number, value: 1|0|-1}[], stake: string|null, scope: string|null}} ballot
 */
export function snapshotFromBallot(ballot) {
  const summary = arrivalSummary(ballot.answers, undefined, {
    group: ballot.scope,
    stake: ballot.stake,
  });
  return {
    club_slug: summary.club.slug,
    room_pct: Math.round(Math.max(0, Math.min(1, summary.probability)) * 100),
  };
}
