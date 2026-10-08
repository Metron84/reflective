/** Browser-check gate. A checkpoint page is only solved by a real page load. */

export const VERIFY_KEY = "play_verify_reload";
export const SESSION_KEY = "play_sid";
const WINDOW_MS = 60 * 1000;

export const VERIFYING = "Verifying your browser...";
export const CHECK_AGAIN = "Your browser needs one more check.";

function stamp(storage, now) {
  const raw = storage?.getItem?.(VERIFY_KEY);
  if (raw == null || raw === "") return false;
  const t = Number(raw);
  return Number.isFinite(t) && now - t >= 0 && now - t < WINDOW_MS;
}

/** True when this ping cannot be trusted and the page must load for real. */
export function needsFullLoad(result) {
  if (result?.ok && result?.data?.ok === true) return false;
  if (result?.debug?.kind === "challenge") return true;
  const type = String(result?.debug?.lastContentType || "");
  if (type && !/json/i.test(type)) return true;
  if (!result || result.status === 0) return true;
  return false;
}

/**
 * What the landing screen does with a finished ping.
 * A challenge inside the last 60 seconds does not reload again.
 */
export function pingGate(result, storage, now = Date.now()) {
  if (result?.ok && result?.data?.ok === true) {
    storage?.removeItem?.(VERIFY_KEY);
    return { play: true, reload: false, held: false };
  }
  if (needsFullLoad(result)) {
    if (stamp(storage, now)) return { play: false, reload: false, held: true };
    storage?.setItem?.(VERIFY_KEY, String(now));
    return { play: false, reload: true, held: false };
  }
  return { play: false, reload: false, held: false };
}

/** Later game requests: only a checkpoint skips the no-connection dialog. */
export function recoverChallenge(result, storage, now = Date.now()) {
  if (result?.debug?.kind !== "challenge") return "none";
  const gate = pingGate(result, storage, now);
  if (gate.reload) return "reload";
  if (gate.held) return "hold";
  return "none";
}

export function noteReload(storage, now = Date.now()) {
  storage?.setItem?.(VERIFY_KEY, String(now));
}

/** Play button while the ping is in flight, ready, or the player is starting. */
export function landingControl(status) {
  if (status === "pending") return { disabled: true, label: VERIFYING };
  if (status === "busy") return { disabled: true, label: "Getting the wheel ready" };
  if (status === "ready") return { disabled: false, label: "Play now" };
  return { disabled: true, label: "Play now" };
}

export function rememberSession(storage, id) {
  if (!id) return;
  storage?.setItem?.(SESSION_KEY, String(id));
}

export function rememberedSession(storage) {
  return storage?.getItem?.(SESSION_KEY) || "";
}

export function forgetSession(storage) {
  storage?.removeItem?.(SESSION_KEY);
}
