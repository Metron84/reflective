const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * fetch that retries a 401 with backoff (1s, 2s, 4s, 8s, 5 tries in all).
 * A 401 mid-draft is usually a transient auth check failure, not a sign-out.
 * Returns the last response; the caller decides what a final 401 means.
 */
export async function fetchRetryOn401(url, init) {
  let res = await fetch(url, init);
  for (const delay of RETRY_DELAYS_MS) {
    if (res.status !== 401) return res;
    await sleep(delay);
    res = await fetch(url, init);
  }
  return res;
}
