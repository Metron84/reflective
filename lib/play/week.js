const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, "0");

function isoDate(ms) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Monday of the Dubai week containing `now`, as YYYY-MM-DD. Weeks run Monday 00:00 to Sunday 23:59 Dubai time. */
export function dubaiWeekStart(now = new Date()) {
  const local = now.getTime() + DUBAI_OFFSET_MS;
  const dow = new Date(local).getUTCDay(); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  return isoDate(local - sinceMonday * DAY_MS);
}

export function lastDubaiWeekStart(now = new Date()) {
  const [y, m, d] = dubaiWeekStart(now).split("-").map(Number);
  return isoDate(Date.UTC(y, m - 1, d) - 7 * DAY_MS);
}

/** "5 Oct to 11 Oct" for a week start. */
export function weekLabel(weekStart) {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const fmt = (ms) =>
    new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(start)} to ${fmt(start + 6 * DAY_MS)}`;
}
