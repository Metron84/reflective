import { fetchWithRetry } from "@/lib/play/fetch-retry";

export const PLAY_PING_PATH = "/api/play/ping";

/** One cheap GET so the browser-check cookie is set before the first spin. Result is ignored. */
export function warmBrowserCheck(opts) {
  return fetchWithRetry(PLAY_PING_PATH, { method: "GET" }, opts).then(
    () => undefined,
    () => undefined,
  );
}
