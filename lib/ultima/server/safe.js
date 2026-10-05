import { logReadError } from "@/lib/ultima/server/strict-db";

/** Never block page render on a slow or unavailable Supabase call. */
export function withTimeout(promise, ms = 2500) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("ultima_query_timeout")), ms);
    }),
  ]);
}

export async function safeResolve(promise, fallback = null) {
  try {
    return await withTimeout(promise);
  } catch (error) {
    logReadError("safeResolve", "-", error);
    return fallback;
  }
}

/**
 * Like safeResolve, but a failure or a timeout throws instead of turning into a
 * fallback. Page loaders use it so the page can say "did not load" rather than
 * show an empty list that looks like real data.
 */
export function loadStrict(promise, ms = 8000) {
  return withTimeout(promise, ms);
}
