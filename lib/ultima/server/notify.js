import { Resend } from "resend";
import { SITE_URL } from "@/lib/config";
import { DEFAULT_CONCIERGE_FROM_EMAIL } from "@/lib/concierge/notify";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { getManagerEmail } from "@/lib/ultima/server/managers";

function fromAddress() {
  return (
    process.env.ULTIMA_FROM_EMAIL?.trim() ||
    process.env.CONCIERGE_FROM_EMAIL?.trim() ||
    DEFAULT_CONCIERGE_FROM_EMAIL
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ultimaHtml({ headline, body, ctaLabel, ctaHref }) {
  const url = `${SITE_URL}${ctaHref.startsWith("/") ? ctaHref : `/${ctaHref}`}`;
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2EDE4;font-family:Arial,Helvetica,sans-serif;color:#0A111F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#F2EDE4;border:1px solid rgba(10,17,31,0.14);">
          <tr>
            <td style="padding:20px 24px;border-bottom:2px solid #D8232A;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(10,17,31,0.55);">Ultima</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#0A111F;">${escapeHtml(headline)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.45;">${escapeHtml(body)}</p>
              <a href="${escapeHtml(url)}" style="display:inline-block;background:#0A111F;color:#F2EDE4;text-decoration:none;padding:10px 18px;font-size:13px;letter-spacing:0.06em;">${escapeHtml(ctaLabel)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function alreadySent(managerId, kind, refId) {
  const db = getUltimaDb();
  if (!db || !managerId) return false;

  const { data } = await db
    .from("ultima_notification_log")
    .select("id")
    .eq("manager_id", managerId)
    .eq("kind", kind)
    .eq("ref_id", refId)
    .maybeSingle();

  return Boolean(data);
}

async function logSent(managerId, kind, refId) {
  const db = getUltimaDb();
  if (!db || !managerId) return;

  await db.from("ultima_notification_log").upsert(
    { manager_id: managerId, kind, ref_id: refId },
    { onConflict: "manager_id,kind,ref_id" },
  );
}

export async function sendUltimaEmail({ to, subject, headline, body, ctaLabel, ctaHref }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[ultima/notify] RESEND_API_KEY unset — skip email.");
    return { skipped: true };
  }
  if (!to) return { skipped: true };

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: [to],
    subject,
    html: ultimaHtml({ headline, body, ctaLabel, ctaHref }),
  });

  if (error) throw new Error(error.message || "Resend send failed");
  return { ok: true };
}

export async function notifyManagerOnce({
  managerId,
  kind,
  refId,
  subject,
  headline,
  body,
  ctaLabel,
  ctaHref,
}) {
  if (await alreadySent(managerId, kind, refId)) {
    return { skipped: true, reason: "deduped" };
  }

  const info = await getManagerEmail(managerId);
  if (!info?.email) return { skipped: true, reason: "no_email" };

  await sendUltimaEmail({
    to: info.email,
    subject,
    headline,
    body,
    ctaLabel,
    ctaHref,
  });

  await logSent(managerId, kind, refId);
  return { ok: true };
}

export function notifyManagerOnceAsync(payload) {
  notifyManagerOnce(payload).catch((err) => {
    console.error("[ultima/notify] email failed:", err?.message || err);
  });
}

export function notifyOnClockAsync({ managerId, pickNumber, secondsRemaining }) {
  if (secondsRemaining < 300) return;
  notifyManagerOnceAsync({
    managerId,
    kind: "draft_on_clock",
    refId: String(pickNumber),
    subject: "Ultima: you are on the clock",
    headline: "Your pick is live",
    body: `Pick ${pickNumber} is yours. The timer is running.`,
    ctaLabel: "Open draft room",
    ctaHref: "/ultima/draft",
  });
}

export function notifyAutoPickAsync({ managerId, pickNumber, playerName }) {
  notifyManagerOnceAsync({
    managerId,
    kind: "draft_auto_pick",
    refId: String(pickNumber),
    subject: "Ultima: auto-pick made",
    headline: "Timer expired",
    body: `${playerName ?? "A player"} was auto-selected on pick ${pickNumber}.`,
    ctaLabel: "View draft",
    ctaHref: "/ultima/draft",
  });
}

export function notifyTradeProposedAsync({ receiverId, tradeId, proposerTeam }) {
  notifyManagerOnceAsync({
    managerId: receiverId,
    kind: "trade_proposed",
    refId: tradeId,
    subject: "Ultima: trade proposal",
    headline: "New trade offer",
    body: `${proposerTeam ?? "A manager"} sent you a trade proposal.`,
    ctaLabel: "Review trade",
    ctaHref: `/ultima/trades/${tradeId}`,
  });
}

export function notifyXiReminderAsync({ managerId, gameweekId, hoursLeft }) {
  notifyManagerOnceAsync({
    managerId,
    kind: "xi_reminder",
    refId: gameweekId,
    subject: "Ultima: set your XV",
    headline: "Lineup deadline approaching",
    body: `Your starting fifteen locks in about ${hoursLeft} hours. Set your XV now.`,
    ctaLabel: "Open squad",
    ctaHref: "/ultima/squad",
  });
}

export function notifyDraftReminderAsync({ managerId, competitionId, kind, scheduledAt }) {
  const is24h = kind === "draft_reminder_24h";
  notifyManagerOnceAsync({
    managerId,
    kind,
    refId: competitionId,
    subject: is24h ? "Ultima: draft in 24 hours" : "Ultima: draft in 1 hour",
    headline: is24h ? "Draft tomorrow" : "Draft in one hour",
    body: `The live draft is scheduled for ${new Date(scheduledAt).toLocaleString("en-GB", { timeZone: "Asia/Dubai" })} GST.`,
    ctaLabel: "Open Ultima",
    ctaHref: "/ultima/draft",
  });
}
