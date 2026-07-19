/** Format seconds as m:ss or h:mm:ss with zero-padded seconds (and minutes when hours). */
export function formatTimestamp(totalSeconds) {
  const n = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  }
  return `${m}:${ss}`;
}
