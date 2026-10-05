let webpush = null;

/** True when the three VAPID env vars are set. Keys live in env only. */
export function pushConfigured() {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim(),
  );
}

export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

/** Loads web-push on first send, so pages that only read the public key stay light. */
async function configure() {
  if (webpush) return true;
  if (!pushConfigured()) return false;
  const mod = await import("web-push");
  const lib = mod.default ?? mod;
  lib.setVapidDetails(
    process.env.VAPID_SUBJECT.trim(),
    process.env.VAPID_PUBLIC_KEY.trim(),
    process.env.VAPID_PRIVATE_KEY.trim(),
  );
  webpush = lib;
  return true;
}

/**
 * Send one push. Resolves { ok: true } or { ok: false, statusCode, gone }.
 * `gone` is true for a 404 or 410: the subscription is dead.
 */
export async function sendWebPush(subscription, payload) {
  if (!(await configure())) return { ok: false, statusCode: 0, gone: false, unconfigured: true };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: "normal" },
    );
    return { ok: true };
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 0;
    return { ok: false, statusCode, gone: statusCode === 404 || statusCode === 410 };
  }
}
