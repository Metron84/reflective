/**
 * Notification rules. Pure: callers pass `now`, nothing reads the clock or the
 * database. Times are Asia/Dubai (UTC+4, no daylight saving).
 */

const GST_OFFSET_MS = 4 * 3_600_000;
const HOUR_MS = 3_600_000;

export const QUIET_START_HOUR = 1;
export const QUIET_END_HOUR = 8;
export const OFFER_EXPIRING_HOURS = 6;
export const LOCK_REMINDER_HOURS = 3;

/**
 * Push categories. The id is the profile toggle; the stored key in
 * ultima_managers.notify_prefs is `push_<id>`. A missing key means on.
 */
export const PUSH_CATEGORIES = [
  { id: "offers", label: "Trade offers" },
  { id: "review", label: "Trades in review" },
  { id: "shortlist", label: "Shortlist" },
  { id: "squad", label: "Squad changes" },
  { id: "locks", label: "Lock reminders" },
  { id: "broadcasts", label: "Commissioner" },
];

export function pushPrefKey(categoryId) {
  return `push_${categoryId}`;
}

export function pushAllowed(prefs, categoryId) {
  const raw = prefs && typeof prefs === "object" ? prefs : {};
  return raw[pushPrefKey(categoryId)] !== false;
}

/** Kinds that push through quiet hours. */
const ALWAYS_PUSH_KINDS = new Set(["offer_expiring", "lock_reminder", "broadcast"]);

function gstParts(ms) {
  const d = new Date(ms + GST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
  };
}

export function gstHour(now = Date.now()) {
  return gstParts(new Date(now).getTime()).hour;
}

/** 01:00 up to, not including, 08:00 in Dubai. */
export function inQuietHours(now = Date.now()) {
  const hour = gstHour(now);
  return hour >= QUIET_START_HOUR && hour < QUIET_END_HOUR;
}

/** The next 08:00 in Dubai at or after `now`, as a UTC ISO string. */
export function quietHoursEnd(now = Date.now()) {
  const ms = new Date(now).getTime();
  const p = gstParts(ms);
  let end = Date.UTC(p.year, p.month, p.day, QUIET_END_HOUR) - GST_OFFSET_MS;
  if (end < ms) end += 24 * HOUR_MS;
  return new Date(end).toISOString();
}

/**
 * Exceptions that always push: an offer expiring within 6 hours, lock
 * reminders and commissioner broadcasts. `expiresAt` is the offer's expiry.
 */
export function alwaysPush(item, now = Date.now()) {
  if (item?.urgent) return true;
  if (ALWAYS_PUSH_KINDS.has(item?.kind)) return true;
  if (item?.expiresAt) {
    const left = new Date(item.expiresAt).getTime() - new Date(now).getTime();
    if (Number.isFinite(left) && left > 0 && left <= OFFER_EXPIRING_HOURS * HOUR_MS) return true;
  }
  return false;
}

/**
 * What to do with the push for one notification.
 * Returns { push_status, send_after }.
 */
export function planPush(item, { prefs, now = Date.now() } = {}) {
  if (!item.push || !pushAllowed(prefs, item.category)) {
    return { push_status: "skipped", send_after: null };
  }
  if (!alwaysPush(item, now) && inQuietHours(now)) {
    return { push_status: "held", send_after: quietHoursEnd(now) };
  }
  return { push_status: "queued", send_after: null };
}

/** Opens inside (now, now + 3 hours]: time for the reminder. */
export function lockReminderDue(openAt, now = Date.now()) {
  const t = new Date(openAt).getTime();
  const n = new Date(now).getTime();
  if (!Number.isFinite(t)) return false;
  return t > n && t - n <= LOCK_REMINDER_HOURS * HOUR_MS;
}

/** True when the manager has an empty slot or no captain in this country. */
export function needsLockReminder(lineup, captainId, league) {
  const slots = (lineup ?? []).filter((r) => r.slot_group === league);
  const empty = slots.length < 3 || slots.some((r) => !r.player_id);
  return empty || !captainId;
}

/** Live offers expire 48 hours after they were sent. Due for the warning inside the last 6. */
export function offerExpiringDue(createdAt, now = Date.now(), liveHours = 48) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const left = created + liveHours * HOUR_MS - new Date(now).getTime();
  return left > 0 && left <= OFFER_EXPIRING_HOURS * HOUR_MS;
}

export function gstClock(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** Allow only app paths, so a notification link can never leave the site. */
export function safeLink(link) {
  if (typeof link !== "string") return "/ultima";
  if (!link.startsWith("/") || link.startsWith("//")) return "/ultima";
  return link;
}

/** Every kind and the push category it belongs to. "league" kinds are inbox only. */
export const KIND_CATEGORY = {
  offer_received: "offers",
  offer_countered: "offers",
  offer_accepted: "offers",
  offer_declined: "offers",
  offer_withdrawn: "offers",
  offer_expired: "offers",
  offer_voided: "offers",
  offer_expiring: "offers",
  trade_review: "review",
  shortlist_listed: "shortlist",
  player_moved: "squad",
  player_left: "squad",
  xv_slot_emptied: "squad",
  lock_reminder: "locks",
  broadcast: "broadcasts",
  trade_executed: "league",
  trade_vetoed: "league",
  market_signing: "league",
  market_release: "league",
};

export function categoryForKind(kind) {
  return KIND_CATEGORY[kind] ?? "league";
}

/** Inbox only: these never push. */
export function isInboxOnly(kind) {
  return categoryForKind(kind) === "league";
}
