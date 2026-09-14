import { darkenHex } from "./color-utils.js";
import { resolveClubGround } from "./club-ground-meta.js";
import { crowdShapesForClub, starsForClub } from "./ground/scene-stars.js";
import { SKYLINE_PATHS, STADIUM_PATH } from "./ground/skyline-paths.js";

const VIEW_W = 390;
const VIEW_H = 844;

/**
 * @param {{
 *   slug?: string;
 *   primary?: string;
 *   secondary?: string;
 *   skylineVariant?: number;
 * }} ground
 * @param {string} slug
 */
export function buildGroundSceneSvgString(ground, slug) {
  const stars = starsForClub(slug);
  const crowd = crowdShapesForClub(slug, ground.primary);
  const variant = Math.min(6, Math.max(1, ground.skylineVariant || 1));
  const skylinePath = SKYLINE_PATHS[/** @type {1|2|3|4|5|6} */ (variant)];
  const skylineFill = darkenHex(ground.primary, 0.4);
  const gradId = "share-sky-grad";
  const glowId = "share-glow";

  const starEls = stars
    .map(
      (s) =>
        `<circle cx="${s.cx.toFixed(2)}" cy="${s.cy.toFixed(2)}" r="${s.r.toFixed(2)}" fill="#F2EDE4" opacity="${s.o.toFixed(3)}" />`,
    )
    .join("");

  const crowdEls = crowd
    .map(
      (c) =>
        `<path d="${c.d}" fill="${escapeAttr(c.fill)}" opacity="0.92" />`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" width="${VIEW_W}" height="${VIEW_H}">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0A111F"/>
      <stop offset="100%" stop-color="${escapeAttr(ground.secondary)}"/>
    </linearGradient>
    <radialGradient id="${glowId}" cx="50%" cy="45%" r="45%">
      <stop offset="0%" stop-color="rgb(242,237,228)" stop-opacity="0.35"/>
      <stop offset="55%" stop-color="rgb(242,237,228)" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="rgb(242,237,228)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${VIEW_W}" height="${VIEW_H}" fill="url(#${gradId})"/>
  <g opacity="0.9">${starEls}</g>
  <path d="${skylinePath}" fill="${escapeAttr(skylineFill)}"/>
  <path d="${STADIUM_PATH}" fill="${escapeAttr(ground.primary)}"/>
  <ellipse cx="195" cy="400" rx="130" ry="36" fill="url(#${glowId})"/>
  <g>${crowdEls}</g>
</svg>`;
}

/** @param {object | null} club */
export function groundSceneSvgForClub(club) {
  const ground = resolveClubGround(club || {});
  const slug = club?.slug || "club";
  return buildGroundSceneSvgString(ground, slug);
}

/** @param {string} s */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}
