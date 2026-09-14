/** @type {Record<string, string>} */
export const CLUSTER_PRIMARY = {
  "iberia-elite": "#FEBE10",
  "madrid-rival": "#CB3524",
  "catalan": "#A50044",
  "north-london": "#EF0107",
  "merseyside-red": "#C8102E",
  "merseyside-blue": "#003399",
  "west-london": "#034694",
  "manchester-red": "#DA291C",
  "manchester-blue": "#6CABDD",
  "yorkshire": "#FFFFFF",
  "midlands": "#95BFE5",
  "east-midlands": "#005BAC",
  "south-coast": "#D71920",
  "east-anglia": "#005AAA",
  "north-east": "#241F20",
  "wales": "#005EB8",
  "scotland": "#005EB8",
  "germany-red": "#DC052D",
  "germany-black": "#000000",
  "italy-north": "#AC975F",
  "italy-capital": "#8B0304",
  "france-capital": "#004170",
  "france-south": "#2FAEE0",
  "global-gulf": "#FFFFFF",
  "community-rebel": "#FFFFFF",
};

const FALLBACK = "#0A111F";

/**
 * @param {{ primary_color?: string|null; cluster?: string|null }} club
 * @returns {string}
 */
export function clubPrimaryColor(club) {
  if (club?.primary && String(club.primary).trim()) {
    return String(club.primary).trim();
  }
  if (club?.primary_color && String(club.primary_color).trim()) {
    return String(club.primary_color).trim();
  }
  const cluster = club?.cluster;
  if (cluster && CLUSTER_PRIMARY[cluster]) {
    return CLUSTER_PRIMARY[cluster];
  }
  return FALLBACK;
}

/**
 * @param {string} hex
 * @returns {boolean}
 */
export function isLightBackground(hex) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.72;
}
