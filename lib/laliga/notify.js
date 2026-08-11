import { Resend } from "resend";
import { CONTACT_EMAIL } from "@/lib/site";

const FROM_EMAIL = "concierge@thereflectivefootball.com";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function buildHtml(row) {
  const when = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const missMost = row.miss_most?.trim() || "Not given";

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2EDE4;font-family:Arial,Helvetica,sans-serif;color:#0A111F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#F2EDE4;border:1px solid rgba(10,17,31,0.14);">
          <tr>
            <td style="padding:20px 24px;border-bottom:2px solid #D8232A;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(10,17,31,0.55);">LaLiga Nights</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#0A111F;">New interest</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Name</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.first_name)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">WhatsApp</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.whatsapp)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Club</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.club)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Frequency</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.frequency)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Group size</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.group_size)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Best day</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.best_day)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Miss most</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.45;white-space:pre-wrap;">${escapeHtml(missMost)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">WhatsApp contact</p>
              <p style="margin:0 0 16px;font-size:16px;">${yesNo(row.contact_ok)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Filming</p>
              <p style="margin:0 0 16px;font-size:16px;">${yesNo(row.filming_ok)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">When</p>
              <p style="margin:0;font-size:16px;">${escapeHtml(when)} GST</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendLaligaInterestEmail(row) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[laliga/notify] RESEND_API_KEY unset — skip email.");
    return { skipped: true };
  }

  const from = process.env.CONCIERGE_FROM_EMAIL?.trim() || FROM_EMAIL;
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [CONTACT_EMAIL],
    subject: `LaLiga Nights: ${row.first_name} · ${row.club}`,
    html: buildHtml(row),
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
  return { ok: true };
}

export function notifyLaligaInterestAsync(row) {
  sendLaligaInterestEmail(row).catch((err) => {
    console.error("[laliga/notify] email failed:", err?.message || err);
  });
}
