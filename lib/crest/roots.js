/**
 * Roots prior. Named clubs carry mass. Loyalty scales how hard that prior
 * pulls. A typed club that is not in the database can be Born to, and it
 * never enters the score.
 */

/** @typedef {"family"|"grew"|"hooked"} RootRole */

/**
 * @typedef {Object} RootClub
 * @property {string|null} slug
 * @property {string} name
 * @property {boolean} typed
 */

/**
 * @typedef {Object} CrestRoots
 * @property {RootClub|null} family
 * @property {RootClub|null} grew
 * @property {{ source: "player"|"tournament"|"match"|"nothing", club: RootClub|null }|null} hooked
 * @property {"always"|"probably"|"drift"|null} stay
 */

export const ROOT_WEIGHT = { family: 0.55, grew: 0.3, hooked: 0.15 };

export const EMPTY_ROOTS = { family: null, grew: null, hooked: null, stay: null };

/**
 * @param {CrestRoots|null|undefined} roots
 * @returns {{ role: RootRole, slug: string|null, name: string, typed: boolean }[]}
 */
export function namedEntries(roots) {
  if (!roots) return [];
  /** @type {{ role: RootRole, slug: string|null, name: string, typed: boolean }[]} */
  const rows = [];
  if (roots.family?.name) rows.push({ role: "family", ...clubOf(roots.family) });
  if (roots.grew?.name) rows.push({ role: "grew", ...clubOf(roots.grew) });
  if (roots.hooked?.club?.name) rows.push({ role: "hooked", ...clubOf(roots.hooked.club) });
  return rows;
}

/**
 * @param {RootClub} club
 */
function clubOf(club) {
  return {
    slug: club.typed ? null : club.slug || null,
    name: club.name,
    typed: Boolean(club.typed) || !club.slug,
  };
}

/**
 * Highest-mass named club, typed or in the database. Masses for the same
 * identity add. Ties break by name, then slug.
 *
 * @param {CrestRoots|null|undefined} roots
 * @returns {{ slug: string|null, name: string, typed: boolean, mass: number }|null}
 */
export function bornTo(roots) {
  /** @type {Map<string, { slug: string|null, name: string, typed: boolean, mass: number }>} */
  const buckets = new Map();
  for (const row of namedEntries(roots)) {
    const key = row.typed || !row.slug ? `typed:${fold(row.name)}` : `slug:${row.slug}`;
    const prev = buckets.get(key) || { slug: row.slug, name: row.name, typed: row.typed || !row.slug, mass: 0 };
    prev.mass += ROOT_WEIGHT[row.role];
    buckets.set(key, prev);
  }
  const list = [...buckets.values()];
  list.sort((a, b) => b.mass - a.mass || a.name.localeCompare(b.name) || (a.slug || "").localeCompare(b.slug || ""));
  return list[0] || null;
}

/**
 * Mass over database clubs only, renormalised to 1 across the ones given.
 * The same slug named twice keeps the sum of its weights, then the map is
 * divided by the total.
 *
 * @param {CrestRoots|null|undefined} roots
 * @returns {Map<string, number>}
 */
export function priorMass(roots) {
  /** @type {Map<string, number>} */
  const raw = new Map();
  for (const row of namedEntries(roots)) {
    if (row.typed || !row.slug) continue;
    raw.set(row.slug, (raw.get(row.slug) || 0) + ROOT_WEIGHT[row.role]);
  }
  const sum = [...raw.values()].reduce((total, value) => total + value, 0);
  /** @type {Map<string, number>} */
  const mass = new Map();
  if (!sum) return mass;
  for (const [slug, value] of raw) mass.set(slug, value / sum);
  return mass;
}

/**
 * λ is 0 when no database club was named. Otherwise it follows the stay answer.
 *
 * @param {CrestRoots|null|undefined} roots
 */
export function loyaltyLambda(roots) {
  if (!priorMass(roots).size) return 0;
  if (roots?.stay === "always") return 1;
  if (roots?.stay === "probably") return 0.6;
  if (roots?.stay === "drift") return 0.15;
  return 0;
}

/**
 * P(club | roots). With no named database club the prior is uniform.
 *
 * @param {string} slug
 * @param {Map<string, number>} mass
 * @param {number} n clubs in scope
 * @param {boolean} uniform
 */
export function rootProbability(slug, mass, n, uniform) {
  const count = n > 0 ? n : 1;
  if (uniform) return 1 / count;
  return 0.15 / count + 0.85 * (mass.get(slug) || 0);
}

/**
 * @param {number} lambda
 * @param {number} prior
 * @param {number} logLikelihood
 */
export function leanScore(lambda, prior, logLikelihood) {
  return lambda * Math.log(Math.max(prior, 1e-9)) + logLikelihood;
}

/**
 * @param {string} value
 */
function fold(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
