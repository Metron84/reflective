/** Client-safe constants (no fs). */
export const QUESTIONS_PER_DAY = 5;
export const STAND_STORAGE_KEY = "trf_stand_v1";

export function gstDay(now = new Date()) {
  const shifted = new Date(now.getTime() + 4 * 3600_000);
  return shifted.toISOString().slice(0, 10);
}
