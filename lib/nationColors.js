/** @type {Record<string, string[]>} */
const NATION_BANDS = {
  Portugal: ["#006600", "#FF0000"],
  Spain: ["#AA151B", "#F1BF00", "#AA151B"],
  Japan: ["#FFFFFF", "#BC002D"],
  Brazil: ["#009C3B", "#FFDF00", "#002776"],
  England: ["#FFFFFF", "#CE1124"],
  Norway: ["#EF2B2D", "#FFFFFF", "#002868"],
  Belgium: ["#231F20", "#FDDA24", "#EF3340"],
  Scotland: ["#005EB8", "#FFFFFF"],
  Egypt: ["#CE1126", "#FFFFFF", "#000000"],
  Mexico: ["#006847", "#FFFFFF", "#CE1126"],
  "South Africa": ["#007A4D", "#FFB612", "#DE3831", "#001489"],
  Australia: ["#00843D", "#FFCD00"],
  Morocco: ["#C1272D", "#006233"],
  "Saudi Arabia": ["#006C35", "#FFFFFF"],
  France: ["#002395", "#FFFFFF", "#ED2939"],
  Iraq: ["#CE1126", "#FFFFFF", "#007A3D", "#000000"],
};

const FALLBACK_BANDS = ["#0A111F"];

/**
 * @typedef {{ nation: string, bands: string[] }} NationSegment
 */

/**
 * Ordered flag colour bands for a single known nation name.
 * @param {string} name
 * @returns {string[]}
 */
function bandsForSingle(name) {
  return NATION_BANDS[name] ?? FALLBACK_BANDS;
}

/**
 * Structured flag segments for a nation value.
 * Accepts a single nation or dual form "Norway & Brazil".
 * Falls back to one navy segment when nation is missing/unknown.
 * @param {string | null | undefined} nation
 * @returns {NationSegment[]}
 */
export function getNationBands(nation) {
  if (!nation || typeof nation !== "string") {
    return [{ nation: "", bands: FALLBACK_BANDS }];
  }

  const parts = nation
    .split(/\s*&\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [{ nation: "", bands: FALLBACK_BANDS }];
  }

  return parts.map((name) => ({
    nation: name,
    bands: bandsForSingle(name),
  }));
}

export { NATION_BANDS };
