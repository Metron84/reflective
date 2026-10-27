/**
 * One results object for the finished swipe. Held in app state until a
 * later step saves it to the TRF profile.
 */

import { CREST_REGIONS } from "./clubs.js";
import { DEFAULT_ALPHA, rankClubs } from "./engine.js";
import { CONFIDENT_ROOM_PCT, matchPercent } from "./report.js";

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

/** @param {string} country */
export function countryFlag(country) {
  return FLAGS[country] || "";
}

/**
 * @param {"Your FC"|"Closest match"} kind
 * @param {string} region
 */
export function regionLabel(kind, region) {
  const place = region === "Rest of the World" ? "the rest of the world" : region;
  return `${kind} in ${place}`;
}

/**
 * @param {import("./engine.js").CrestRank} row
 */
function clubRow(row) {
  const club = row.club;
  return {
    slug: club.slug,
    name: club.name,
    region: club.region,
    country: club.country,
    league: club.competition,
    city: club.city,
    color: club.color,
    percentage: matchPercent(row.score),
    flag: countryFlag(club.country),
  };
}

/**
 * Rank every club in the selected scope, then the top club in each region.
 * The percentage is the engine match score. Under 80 the card says Closest match.
 * Rest of the World keeps a ranked top five.
 *
 * @param {import("./engine.js").CrestAnswer[]} answers
 * @param {{ group?: string|null, stake?: string|null }} [options]
 */
export function buildScopeResults(answers, options = {}) {
  const ranked = rankClubs(answers, DEFAULT_ALPHA, {
    group: options.group || null,
    stake: options.stake || null,
    colour: null,
    competition: null,
  });
  const clubs = ranked.map(clubRow);
  const tops = {};
  const regions = [];

  for (const region of CREST_REGIONS) {
    const inRegion = clubs.filter((club) => club.region === region);
    const top = inRegion[0] || null;
    tops[region] = top;
    if (!top) continue;
    const kind = top.percentage < CONFIDENT_ROOM_PCT ? "Closest match" : "Your FC";
    regions.push({
      region,
      percentage: top.percentage,
      label: regionLabel(kind, region),
      top,
      ranked: region === "Rest of the World" ? inRegion.slice(0, 5) : [top],
    });
  }

  regions.sort((a, b) => b.percentage - a.percentage || a.region.localeCompare(b.region));

  return {
    scope: options.group || null,
    clubs,
    tops,
    regions,
  };
}
