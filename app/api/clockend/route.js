import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import {
  ATTENDANCE_OPTIONS,
  GROUP_SIZE_OPTIONS,
  WATCH_STYLE_OPTIONS,
} from "@/lib/clockend/options";
import { normalizeInstagram, normalizeWhatsapp } from "@/lib/clockend/normalize";

export const runtime = "nodejs";

const ATTENDANCE = new Set(ATTENDANCE_OPTIONS.map((o) => o.value));
const GROUP_SIZES = new Set(GROUP_SIZE_OPTIONS.map((o) => o.value));
const WATCH_STYLES = new Set(WATCH_STYLE_OPTIONS.map((o) => o.value));

/** Same sliding window as Write to Melo: 3 submissions per IP per hour. */
const RATE_LIMIT = { windowMs: 60 * 60_000, max: 3 };
const rateMap = new Map();

function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT.windowMs,
  );
  hits.push(now);
  rateMap.set(ip, hits);
  if (rateMap.size > 10_000) rateMap.clear();
  return hits.length > RATE_LIMIT.max;
}

function fail(reason, status = 400) {
  return NextResponse.json({ ok: false, reason }, { status });
}

function asBoolOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("invalid-request");
  }

  // Honeypot: pretend it worked, insert nothing.
  if (body?.website) return NextResponse.json({ ok: true });

  if (rateLimited(getClientIp(request))) return fail("rate-limited", 429);

  const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : "";
  if (fullName.length < 2) return fail("name-required");
  if (fullName.length > 120) return fail("name-too-long");

  const rawWhatsapp = typeof body?.whatsapp === "string" ? body.whatsapp.trim() : "";
  if (!rawWhatsapp) return fail("whatsapp-required");
  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return fail("whatsapp-invalid");

  const instagram = normalizeInstagram(body?.instagram);
  if (!instagram.valid) return fail("instagram-invalid");

  if (body?.contact_consent !== true) return fail("consent-required");

  const attendanceIn = Array.isArray(body?.attendance) ? body.attendance : [];
  if (attendanceIn.some((v) => !ATTENDANCE.has(v))) return fail("choice-invalid");
  const attendance = attendanceIn.includes("every_game")
    ? ["every_game"]
    : [...new Set(attendanceIn)];

  const groupSize = body?.group_size ?? null;
  if (groupSize !== null && !GROUP_SIZES.has(groupSize)) return fail("choice-invalid");

  const watchStyle = body?.watch_style ?? null;
  if (watchStyle !== null && !WATCH_STYLES.has(watchStyle)) return fail("choice-invalid");

  const row = {
    full_name: fullName,
    whatsapp,
    instagram: instagram.value,
    arsenal_uae_member: asBoolOrNull(body?.arsenal_uae_member),
    attendance,
    group_size: groupSize,
    watch_style: watchStyle,
    film_consent: asBoolOrNull(body?.film_consent),
    contact_consent: true,
  };

  const supabase = getServiceClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") return fail("unavailable", 503);
    return NextResponse.json({ ok: true, simulated: true });
  }

  const { error } = await supabase.from("clockend_signups").insert(row);

  if (error) {
    // Unique WhatsApp number: they are already on the list.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, already: true });
    }
    // Table not created yet: simulate locally, never in production.
    if (
      (error.code === "42P01" || error.code === "PGRST205") &&
      process.env.NODE_ENV !== "production"
    ) {
      return NextResponse.json({ ok: true, simulated: true });
    }
    return fail("server-error", 500);
  }

  return NextResponse.json({ ok: true });
}
