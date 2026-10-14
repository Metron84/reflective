/**
 * The daily board schedule: which 5 players appear on which Dubai day.
 *
 * The pool is laid out once in a fixed cyclic order, and each day takes the next 5 slots:
 * day d covers slots 5d to 5d+4, wrapping round the pool. Two things follow from that.
 *
 * - A player returns every N slots (N is the pool size), so with N of at least 290 the same
 *   player is never on two boards less than 58 days apart.
 * - The order is built so that any 5 consecutive slots, wherever the day boundaries fall, hold
 *   at most 2 players from one league, so every board mixes at least 3 leagues. Because N is not
 *   a multiple of 5, the day boundaries shift each lap and boards do not repeat.
 *
 * Pure and deterministic: the same pool always gives the same schedule.
 */

export const BOARD_SIZE = 5;
export const MIN_GAP_DAYS = 58;
export const MAX_PER_LEAGUE = 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** True when every cyclic run of BOARD_SIZE slots has at most MAX_PER_LEAGUE of one league. */
export function windowsValid(order, leagueOf) {
  const n = order.length;
  if (n < BOARD_SIZE) return false;
  for (let start = 0; start < n; start += 1) {
    const counts = new Map();
    for (let k = 0; k < BOARD_SIZE; k += 1) {
      const league = leagueOf(order[(start + k) % n]);
      const c = (counts.get(league) ?? 0) + 1;
      if (c > MAX_PER_LEAGUE) return false;
      counts.set(league, c);
    }
  }
  return true;
}

function attempt(items, leagueOf, seed) {
  const rnd = mulberry32(seed);
  const queues = new Map();
  for (const item of shuffled(items, rnd)) {
    const league = leagueOf(item);
    if (!queues.has(league)) queues.set(league, []);
    queues.get(league).push(item);
  }
  const out = [];
  while (out.length < items.length) {
    const recent = out.slice(-(BOARD_SIZE - 1)).map(leagueOf);
    // Adding this item makes a run of 5 with the last 4 placed, so a league may already hold
    // at most MAX_PER_LEAGUE - 1 of those 4.
    const open = [...queues.entries()].filter(
      ([league, q]) => q.length > 0 && recent.filter((l) => l === league).length <= MAX_PER_LEAGUE - 1,
    );
    if (!open.length) return null;
    // Largest queue first keeps the leagues running out together instead of one dominating the tail.
    const most = Math.max(...open.map(([, q]) => q.length));
    const best = open.filter(([, q]) => q.length === most);
    const [, queue] = best[Math.floor(rnd() * best.length)];
    out.push(queue.pop());
  }
  return out;
}

/**
 * Arrange the pool into the cyclic order. Tries seeds until the cyclic rule holds.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string} leagueOf
 * @returns {T[]}
 */
export function buildOrder(items, leagueOf, seed = 20260713) {
  for (let i = 0; i < 2000; i += 1) {
    const order = attempt(items, leagueOf, seed + i);
    if (order && windowsValid(order, leagueOf)) return order;
  }
  throw new Error("Could not arrange the Guesser pool so every board mixes leagues.");
}

/** The 5 items for a day index (days since the Guesser epoch, 0 or more). */
export function boardForDay(order, dayIndex) {
  const n = order.length;
  const start = (((dayIndex * BOARD_SIZE) % n) + n) % n;
  return Array.from({ length: BOARD_SIZE }, (_, k) => order[(start + k) % n]);
}

/** Smallest number of days between two appearances of any one player, over `days` days. */
export function minGapDays(order, days) {
  const last = new Map();
  let min = Infinity;
  for (let d = 0; d < days; d += 1) {
    for (const item of boardForDay(order, d)) {
      if (last.has(item)) min = Math.min(min, d - last.get(item));
      last.set(item, d);
    }
  }
  return min;
}
