export const SOCIAL_MIN_RUNS = 30;

export function fanPickPercent(matched, total) {
  const fans = Number(total) || 0;
  const picks = Number(matched) || 0;
  if (fans < SOCIAL_MIN_RUNS) return null;
  return Math.floor((picks * 100) / fans);
}
