import "server-only";
import { Resend } from "resend";
import { SITE_URL } from "@/lib/config";
import { WATCHWITH_APP_HOST } from "./host";
import { signFanToken } from "./token";

function secret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendResultEmail({ email, champion, clubName, clubSlug }) {
  const key = secret();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!key || !apiKey) {
    console.info("watch-with/notify skipped");
    return { sent: false };
  }
  const token = signFanToken(email, clubSlug, key);
  const verifyUrl = `${SITE_URL}/api/watch-with/verify?token=${encodeURIComponent(token)}`;
  const rankingUrl = `https://${WATCHWITH_APP_HOST}/${clubSlug}/ranking`;
  const from = process.env.CONCIERGE_FROM_EMAIL?.trim() || "concierge@thereflectivefootball.com";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: `Your matchday companion is ${champion}`,
    html: `<div style="background:#F2EDE4;color:#0A111F;font-family:Arial,Helvetica,sans-serif;padding:24px;">
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;">${escapeHtml(clubName)}</p>
      <h1 style="margin:0 0 12px;font-size:28px;">Your matchday companion is ${escapeHtml(champion)}.</h1>
      <p style="margin:0 0 16px;font-size:16px;">Verify your vote to join the ranking as a verified fan.</p>
      <p style="margin:0 0 16px;"><a href="${verifyUrl}" style="color:#D8232A;">Verify my vote</a></p>
      <p style="margin:0;"><a href="${rankingUrl}" style="color:#0A111F;">See the ranking</a></p>
    </div>`,
    text: [
      `${clubName}`,
      `Your matchday companion is ${champion}.`,
      "Verify your vote to join the ranking as a verified fan.",
      verifyUrl,
      rankingUrl,
    ].join("\n"),
  });
  if (error) {
    console.error("watch-with/notify", error);
    return { sent: false };
  }
  return { sent: true };
}

export function fanTokenSecret() {
  return secret();
}
