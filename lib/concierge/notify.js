import { Resend } from "resend";
import { SITE_URL } from "@/lib/config";

/** Fallback when CONCIERGE_FROM_EMAIL is unset. Env wins if set. */
export const DEFAULT_CONCIERGE_FROM_EMAIL = "concierge@thereflectivefootball.com";

function fromAddress() {
  const env = process.env.CONCIERGE_FROM_EMAIL?.trim();
  return env || DEFAULT_CONCIERGE_FROM_EMAIL;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml({ topic, name, email, message, createdAt }) {
  const when = createdAt
    ? new Date(createdAt).toLocaleString("en-GB", {
        timeZone: "Asia/Dubai",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Just now";
  const inboxUrl = `${SITE_URL}/admin/messages`;
  const displayName = name?.trim() || "Anonymous";
  const displayEmail = email?.trim() || "Not provided";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2EDE4;font-family:Arial,Helvetica,sans-serif;color:#0A111F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#F2EDE4;border:1px solid rgba(10,17,31,0.14);">
          <tr>
            <td style="padding:20px 24px;border-bottom:2px solid #D8232A;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(10,17,31,0.55);">The Concierge</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#0A111F;">New message</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Topic</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(topic)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">From</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(displayName)} · ${escapeHtml(displayEmail)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">When</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(when)} GST</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Message</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.45;white-space:pre-wrap;">${escapeHtml(message)}</p>
              <p style="margin:0;">
                <a href="${escapeHtml(inboxUrl)}" style="display:inline-block;background:#0A111F;color:#F2EDE4;text-decoration:none;padding:10px 18px;font-size:13px;letter-spacing:0.06em;">Open inbox</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Fire-and-forget safe: call without awaiting visitor response.
 * Logs and no-ops when RESEND_API_KEY or CONCIERGE_NOTIFY_EMAIL is missing.
 */
export async function sendConciergeNotifyEmail({
  topic,
  name,
  email,
  message,
  createdAt,
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[concierge/notify] RESEND_API_KEY unset — skip email.");
    return { skipped: true };
  }

  const to = process.env.CONCIERGE_NOTIFY_EMAIL?.trim();
  if (!to) {
    console.info("[concierge/notify] CONCIERGE_NOTIFY_EMAIL unset — skip email.");
    return { skipped: true };
  }

  const resend = new Resend(apiKey);
  const subjectName = name?.trim() ? ` · ${name.trim()}` : "";
  const subject = `Concierge message: ${topic}${subjectName}`;

  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: [to],
    subject,
    html: buildHtml({ topic, name, email, message, createdAt }),
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
  return { ok: true };
}

/** Non-blocking wrapper for the handoff route. */
export function notifyConciergeMessageAsync(payload) {
  sendConciergeNotifyEmail(payload).catch((err) => {
    console.error("[concierge/notify] email failed:", err?.message || err);
  });
}
