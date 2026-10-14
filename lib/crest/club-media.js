import media from "./club-media.json" with { type: "json" };

/**
 * Sportmonks media for a club, from scripts/crest-club-media.mjs:
 * { sportmonks_id, badge_url, primary, secondary, colour_source, matched_name }.
 * Null for a club the script could not match, so callers fall back to club.color.
 *
 * @param {string} slug
 */
export function clubMedia(slug) {
  return media[slug] ?? null;
}
