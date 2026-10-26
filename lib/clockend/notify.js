import { Resend } from "resend";
import {
  ATTENDANCE_OPTIONS,
  GROUP_SIZE_OPTIONS,
  WATCH_STYLE_OPTIONS,
} from "./options";

const FROM = "Clock End Dubai <clockend@thereflectivefootball.com>";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function labels(options, values) {
  const wanted = new Set(values ?? []);
  const picked = options.filter((option) => wanted.has(option.value)).map((option) => option.label);
  return picked.length ? picked.join(", ") : "Not answered";
}

function yesNo(value, yes, no) {
  if (value === true) return yes;
  if (value === false) return no;
  return "Not answered";
}

function dubaiTime(createdAt) {
  const when = createdAt ? new Date(createdAt) : new Date();
  return when.toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function whatsappHref(whatsapp) {
  const digits = String(whatsapp ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function instagramHref(handle) {
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

/**
 * Email one new Clock End sign-up. Uses the Concierge Resend key and inbox.
 * Throws when Resend rejects the send. Missing config is logged and skipped.
 */
export async function sendClockendSignupEmail({
  full_name: fullName,
  whatsapp,
  instagram,
  arsenal_uae_member: member,
  attendance,
  group_size: groupSize,
  watch_styles: watchStyles,
  film_consent: filmConsent,
  createdAt,
  total,
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info("[clockend/notify] RESEND_API_KEY unset. Skip email.");
    return { skipped: true };
  }

  const to = process.env.CONCIERGE_NOTIFY_EMAIL?.trim();
  if (!to) {
    console.info("[clockend/notify] CONCIERGE_NOTIFY_EMAIL unset. Skip email.");
    return { skipped: true };
  }

  const name = String(fullName ?? "").replace(/[\r\n]+/g, " ").trim();
  const totalLabel = Number.isInteger(total) ? String(total) : "unknown";
  const when = `${dubaiTime(createdAt)} Dubai time`;
  const wa = whatsappHref(whatsapp);
  const ig = instagramHref(instagram);
  const whenTheyCome = labels(ATTENDANCE_OPTIONS, attendance);
  const groupLabel =
    GROUP_SIZE_OPTIONS.find((option) => option.value === groupSize)?.label ?? "Not answered";
  const howTheyWatch = labels(WATCH_STYLE_OPTIONS, watchStyles);
  const memberLabel = yesNo(member, "Yes", "No");
  const filmLabel = yesNo(filmConsent, "Yes, film me", "Rather not");

  const rows = [
    ["Name", escapeHtml(name)],
    [
      "WhatsApp",
      wa
        ? `<a href="${escapeHtml(wa)}">${escapeHtml(whatsapp)}</a>`
        : escapeHtml(whatsapp || "Not given"),
    ],
    [
      "Instagram",
      ig ? `<a href="${escapeHtml(ig)}">@${escapeHtml(instagram)}</a>` : "Not given",
    ],
    ["Arsenal UAE member", escapeHtml(memberLabel)],
    ["When they come", escapeHtml(whenTheyCome)],
    ["Group size", escapeHtml(groupLabel)],
    ["How they watch", escapeHtml(howTheyWatch)],
    ["Filming consent", escapeHtml(filmLabel)],
    ["Time", escapeHtml(when)],
    ["Sign-ups so far", escapeHtml(totalLabel)],
  ];

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(10,17,31,0.5);">${label}</p><p style="margin:0 0 16px;font-size:16px;">${value}</p>`,
    )
    .join("");

  const text = [
    `Name: ${name}`,
    `WhatsApp: ${wa || whatsapp || "Not given"}`,
    `Instagram: ${ig || "Not given"}`,
    `Arsenal UAE member: ${memberLabel}`,
    `When they come: ${whenTheyCome}`,
    `Group size: ${groupLabel}`,
    `How they watch: ${howTheyWatch}`,
    `Filming consent: ${filmLabel}`,
    `Time: ${when}`,
    `Sign-ups so far: ${totalLabel}`,
  ].join("\n");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject: `Clock End sign-up #${totalLabel}: ${name}`,
    html: `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F2EDE4;font-family:Arial,Helvetica,sans-serif;color:#0A111F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2EDE4;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#F2EDE4;border:1px solid rgba(10,17,31,0.14);">
          <tr>
            <td style="padding:20px 24px;border-bottom:2px solid #D8232A;">
              <p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(10,17,31,0.55);">Clock End Dubai</p>
              <h1 style="margin:8px 0 0;font-size:22px;line-height:1.2;color:#0A111F;">New sign-up</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">${htmlRows}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text,
  });

  if (error) {
    throw new Error(error.message || "Resend send failed");
  }
  return { ok: true };
}
