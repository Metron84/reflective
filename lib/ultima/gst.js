/**
 * Gulf Standard Time (Asia/Dubai, UTC+4, no daylight saving) helpers.
 * Every admin time input is wall-clock GST. Saved values are UTC ISO strings.
 */

const GST_ZONE = "Asia/Dubai";
const GST_OFFSET = "+04:00";
const NAIVE_LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/;

function partsInGst(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: GST_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** UTC ISO string to the value a datetime-local input shows, in GST. */
export function toGstInputValue(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = partsInGst(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * What the admin typed (wall-clock GST, no offset) to a UTC ISO string.
 * A value that already carries an offset or Z is taken as given. Null when invalid.
 */
export function fromGstInput(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const naive = NAIVE_LOCAL.exec(text);
  const date = naive
    ? new Date(`${naive[1]}T${naive[2]}${naive[3] ?? ":00"}${GST_OFFSET}`)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "16:00" */
export function formatGstTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const p = partsInGst(date);
  return `${p.hour}:${p.minute}`;
}

/** "Sun 4 Oct, 16:00" */
export function formatGstDateTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: GST_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  return `${day.replace(",", "")}, ${formatGstTime(iso)}`;
}

/** "9:41" or "1:02:03" from milliseconds. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
