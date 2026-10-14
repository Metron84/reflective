/**
 * When the board should next ask the server, and what the lock countdown shows. Pure and client-safe.
 *
 * The server owns every deadline. The client never decides that a lock is over: it asks again at the
 * time the server reported (`unlocksInMs`, or the typing deadline), and the answer box only re-enables
 * once a server reading says `lockedOut: false`. These helpers only choose when to ask.
 */
import { ANSWER_GRACE_MS, ROUND_MS, WINDOW_MS } from "./engine";

/** Asked this long after the due time so the server's clock has certainly passed it. */
export const SYNC_PAD_MS = 150;

/**
 * Milliseconds from receiving a live reading `cur` until the client should ask again.
 * - Frozen: when the typing window and its grace have run out, so the server can settle a time-out.
 * - Locked: the server's own unlock time (`unlocksInMs`), or the next clue if that comes first.
 * - Otherwise: the next window, where the next clue and point value land.
 */
export function nextSyncDelay(cur) {
  if (cur.frozen) return cur.answerRemainingMs + ANSWER_GRACE_MS + 200;
  const nextWindow = Math.min(ROUND_MS, (Math.floor(cur.elapsedMs / WINDOW_MS) + 1) * WINDOW_MS);
  let delay = nextWindow - cur.elapsedMs + SYNC_PAD_MS;
  if (cur.lockedOut) delay = Math.min(delay, cur.unlocksInMs + SYNC_PAD_MS);
  return Math.max(150, delay);
}

/** Whole seconds the lock countdown shows, counted from the server's `unlocksInMs`. Never below 1 while locked. */
export function unlockSeconds(cur, sinceSyncMs) {
  if (!cur?.lockedOut) return 0;
  return Math.max(1, Math.ceil(Math.max(0, cur.unlocksInMs - sinceSyncMs) / 1000));
}
