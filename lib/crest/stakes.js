/**
 * The want menu. One tap chooses the deck and the club pool.
 * It does not multiply weights.
 *
 * Retired ids have no deck. A stored run with one of them goes back to this menu.
 */

/** @typedef {'belonging'|'love'|'winning'|'belonging_love'|'love_winning'} CrestStakeId */

/**
 * @typedef {Object} CrestStake
 * @property {CrestStakeId} id
 * @property {string} label
 * @property {string} line
 */

/** @type {CrestStake[]} */
export const STAKES = [
  { id: "belonging", label: "Belonging", line: "My people. My place." },
  { id: "love", label: "Love", line: "A club I can love." },
  { id: "winning", label: "Winning", line: "The table. The nights that count." },
  { id: "belonging_love", label: "Belonging and love", line: "My people, and a club I can love." },
  { id: "love_winning", label: "Love and winning", line: "A club I can love, and the nights that count." },
];

const RETIRED = new Set(["belonging_winning", "fame_fortune", "fortune"]);
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
 * A removed want is not a stake. Callers should send the person back to the menu.
 *
 * @param {string|null|undefined} id
 * @returns {CrestStakeId|null}
 */
export function liveStake(id) {
  if (!id || RETIRED.has(id)) return null;
  return isStake(id) ? /** @type {CrestStakeId} */ (id) : null;
}

/**
 * Kept for older callers. The suit score does not use it.
 *
 * @param {string|null|undefined} _stakeId
 * @param {number} _facet
 */
export function stakeCoeff(_stakeId, _facet) {
  return 1;
}

/**
 * @param {string|null|undefined} stakeId
 */
export function stakeLine(stakeId) {
  const row = getStake(stakeId);
  if (!row) return "";
  return `You wanted ${row.label.toLowerCase()}.`;
}
