import { DRAFT_ROOM_OPENS_MINUTES_BEFORE } from "./constants.js";

/**
 * Season draft room window.
 *
 * - Before `opensAt` (first pick minus 10 minutes): room closed.
 * - From `opensAt`: room open, picks still off until the draft is started.
 * - From `startsAt`: the commissioner's Start button unlocks.
 *
 * With no scheduled time the room is open and Start is unlocked, as before.
 */
export function draftRoomWindow({
  scheduledAt,
  now = Date.now(),
  minutesBefore = DRAFT_ROOM_OPENS_MINUTES_BEFORE,
}) {
  const start = scheduledAt ? new Date(scheduledAt).getTime() : NaN;
  if (!Number.isFinite(start)) {
    return {
      scheduled: false,
      open: true,
      startUnlocked: true,
      opensAt: null,
      startsAt: null,
      msToOpen: 0,
      msToStart: 0,
    };
  }
  const opens = start - minutesBefore * 60_000;
  return {
    scheduled: true,
    open: now >= opens,
    startUnlocked: now >= start,
    opensAt: new Date(opens).toISOString(),
    startsAt: new Date(start).toISOString(),
    msToOpen: Math.max(0, opens - now),
    msToStart: Math.max(0, start - now),
  };
}
