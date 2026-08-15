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
  } catch {
    return fallback;
  }
}
