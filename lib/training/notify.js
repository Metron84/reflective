import { Resend } from "resend";
import { CONTACT_EMAIL } from "@/lib/site";
import { TRAINING_TERMS, trainingTermsPlainText } from "@/lib/training/terms";

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

function formatAcceptedAt(iso) {
  const date = iso ? new Date(iso) : new Date();
  if (Number.isNaN(date.getTime())) {
    return String(iso ?? "");
  }
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildHtml(row) {
  const acceptedAt = formatAcceptedAt(row.accepted_at);
  const termsHtml = TRAINING_TERMS.map(
    (line) =>
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">${escapeHtml(line)}</p>`,
  ).join("");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2EDE4;font-family:Arial,Helvetica,sans-serif;color:#0A111F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#F2EDE4;border:1px solid rgba(10,17,31,0.14);">
          <tr>
            <td style="padding:20px 24px;border-bottom:2px solid #D8232A;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(10,17,31,0.55);">Media Training</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#0A111F;">Payment request</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Name</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.full_name)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Email</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.email)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">WhatsApp</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.whatsapp)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Describes</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.describes_you)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Filmed before</p>
              <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(row.filmed_before)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Why a seat</p>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.45;white-space:pre-wrap;">${escapeHtml(row.why_seat)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Accepted terms</p>
              <p style="margin:0 0 16px;font-size:16px;">${yesNo(row.accepted_terms)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Accepted fee</p>
              <p style="margin:0 0 16px;font-size:16px;">${yesNo(row.accepted_fee)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Requested payment details</p>
              <p style="margin:0 0 16px;font-size:16px;">${yesNo(row.requested_payment_details)}</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Accepted at</p>
              <p style="margin:0 0 20px;font-size:16px;">${escapeHtml(acceptedAt)} GST</p>
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">Terms accepted</p>
              <div style="margin:0;padding:12px 14px;border:1px solid rgba(10,17,31,0.14);">
                ${termsHtml}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(row) {
  const acceptedAt = formatAcceptedAt(row.accepted_at);
  return [
    "Media Training payment request",
    "",
    `Name: ${row.full_name}`,
    `Email: ${row.email}`,
    `WhatsApp: ${row.whatsapp}`,
    `Describes: ${row.describes_you}`,
    `Filmed before: ${row.filmed_before}`,
    `Why a seat: ${row.why_seat}`,
    "",
    `Accepted terms: ${yesNo(row.accepted_terms)}`,
    `Accepted fee: ${yesNo(row.accepted_fee)}`,
    `Requested payment details: ${yesNo(row.requested_payment_details)}`,
    `Accepted at: ${acceptedAt} GST`,
    "",
    "Terms accepted:",
    trainingTermsPlainText(),
  ].join("\n");
}

export async function sendTrainingApplicationEmail(row) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[training/notify] RESEND_API_KEY unset — skip email.");
    return { skipped: true };
  }

  const from = process.env.CONCIERGE_FROM_EMAIL?.trim() || FROM_EMAIL;
  const to = process.env.TRAINING_NOTIFY_EMAIL?.trim() || CONTACT_EMAIL;
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: `Media Training: ${row.full_name}`,
    html: buildHtml(row),
    text: buildText(row),
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
  return { ok: true };
}

export function notifyTrainingApplicationAsync(row) {
  sendTrainingApplicationEmail(row).catch((err) => {
    console.error("[training/notify] email failed:", err?.message || err);
  });
}
