/**
 * First-chip stakes for The Crest. One tap. That tap sets coefficients
 * for Life and every card after, and the Life queue.
 *
 * Stake rooms are 2. Nothing is 0. Neighbours are 1.4. The rest stay 1.
 * Facet index: 0 winning, 1 climate, 2 people, 3 meaning, 4 style, 5 risk,
 * 6 talent, 7 heart/head, 8 reach, 9 time, 10 power, 11 purpose.
 */

/** @typedef {'belonging'|'winning'|'belonging_winning'|'fame_fortune'|'fortune'|'love'} CrestStakeId */

/**
 * @typedef {Object} CrestStake
 * @property {CrestStakeId} id
 * @property {string} label
 * @property {string} line
 * @property {number[]} coeff length 12
 * @property {number[]} life Life card ids in play order
 */

const DEFAULT_LIFE = [1, 2, 3, 4, 5];
const ALLOWED = new Set([1, 1.4, 2]);

/**
 * @param {number[]} hot 2.0 facet indexes
 * @param {number[]} warm 1.4 facet indexes
 */
function coeffs(hot, warm) {
  const row = Array(12).fill(1);
  for (const i of hot) row[i] = 2;
  for (const i of warm) row[i] = 1.4;
  return row;
}

/** @type {CrestStake[]} */
export const STAKES = [
  {
    id: "belonging",
    label: "Belonging",
    line: "My people. My place.",
    coeff: coeffs([3, 2, 8], [9, 10, 11]),
    life: [3, 4, 5, 1, 2],
  },
  {
    id: "winning",
    label: "Winning",
    line: "The table. The nights that count.",
    coeff: coeffs([0, 11], [3, 4]),
    life: [2, 1, 3, 4, 5],
  },
  {
    id: "belonging_winning",
    label: "Belonging and winning",
    line: "The room, and the result.",
    coeff: coeffs([0, 3, 11], [2, 8]),
    life: [2, 3, 4, 1, 5],
  },
  {
    id: "fame_fortune",
    label: "Fame and fortune",
    line: "The name and the money.",
    coeff: coeffs([8, 10, 3], [6, 11]),
    life: [4, 2, 1, 5, 3],
  },
  {
    id: "fortune",
    label: "Fortune",
    line: "The money. The machine.",
    coeff: coeffs([10, 6], [0, 8, 3]),
    life: [1, 2, 4, 5, 3],
  },
  {
    id: "love",
    label: "Love",
    line: "A club I can love.",
    coeff: coeffs([7, 1, 4], [3, 11]),
    life: [1, 3, 2, 4, 5],
  },
];

const BY_ID = new Map(STAKES.map((row) => [row.id, row]));

/**
 * @param {string|null|undefined} id
 * @returns {CrestStake|null}
 */
export function getStake(id) {
  if (!id) return null;
  return BY_ID.get(id) || null;
}

/**
 * @param {string|null|undefined} id
 */
export function isStake(id) {
  return Boolean(getStake(id));
}

/**
 * Coefficient for a facet under this chip. No chip means every room is 1.
 *
 * @param {string|null|undefined} stakeId
 * @param {number} facet
 */
export function stakeCoeff(stakeId, facet) {
  const row = getStake(stakeId);
  if (!row || facet < 0 || facet >= 12) return 1;
  const value = row.coeff[facet];
  return ALLOWED.has(value) ? value : 1;
}

/**
 * Life card ids in play order. No chip keeps the original 1 to 5.
 *
 * @param {string|null|undefined} stakeId
 * @returns {number[]}
 */
export function lifeOrder(stakeId) {
  const row = getStake(stakeId);
  return row ? row.life.slice() : DEFAULT_LIFE.slice();
}

/**
 * @param {string|null|undefined} stakeId
 */
export function stakeLine(stakeId) {
  const row = getStake(stakeId);
  if (!row) return "";
  return `You wanted ${row.label.toLowerCase()}.`;
}
