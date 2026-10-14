import rivalsJson from "./rivals.json" with { type: "json" };

/**
 * Club rivalries, from scripts/build-crest-rivals.mjs. Two-way: if a lists b, b lists a.
 * Shape: { slug: [rival slugs] }.
 */
export const RIVALS = rivalsJson;

export function rivalsOf(slug) {
  return RIVALS[slug] ?? [];
}

export function areRivals(a, b, rivals = RIVALS) {
  return (rivals[a] ?? []).includes(b) || (rivals[b] ?? []).includes(a);
}
