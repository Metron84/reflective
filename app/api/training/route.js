import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { notifyTrainingApplicationAsync } from "@/lib/training/notify";

export const runtime = "nodejs";

const DESCRIBES = new Set([
  "Student",
  "Recent graduate",
  "Changing career",
  "Already creating content",
  "Other",
]);

const FILMED_BEFORE = new Set(["No", "A little", "Yes"]);

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

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asBool(value) {
  return value === true;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Silent success for honeypot spam — no insert. */
function silentOk() {
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid-request" },
      { status: 400 },
    );
  }

  if (body?.website) {
    return silentOk();
  }

  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429 },
    );
  }

  const fullName = asTrimmedString(body?.full_name);
  if (!fullName) {
    return NextResponse.json(
      { ok: false, reason: "full_name-required" },
      { status: 400 },
    );
  }
  if (fullName.length > 120) {
    return NextResponse.json(
      { ok: false, reason: "full_name-too-long" },
      { status: 400 },
    );
  }

  const emailRaw = asTrimmedString(body?.email).toLowerCase();
  if (!emailRaw) {
    return NextResponse.json(
      { ok: false, reason: "email-required" },
      { status: 400 },
    );
  }
  if (emailRaw.length > 200) {
    return NextResponse.json(
      { ok: false, reason: "email-too-long" },
      { status: 400 },
    );
  }
  if (!isValidEmail(emailRaw)) {
    return NextResponse.json(
      { ok: false, reason: "email-invalid" },
      { status: 400 },
    );
  }

  const whatsapp = asTrimmedString(body?.whatsapp);
  if (!whatsapp) {
    return NextResponse.json(
      { ok: false, reason: "whatsapp-required" },
      { status: 400 },
    );
  }
  if (whatsapp.length > 40) {
    return NextResponse.json(
      { ok: false, reason: "whatsapp-too-long" },
      { status: 400 },
    );
  }

  const describesYou = asTrimmedString(body?.describes_you);
  if (!describesYou) {
    return NextResponse.json(
      { ok: false, reason: "describes-required" },
      { status: 400 },
    );
  }
  if (!DESCRIBES.has(describesYou)) {
    return NextResponse.json(
      { ok: false, reason: "describes-invalid" },
      { status: 400 },
    );
  }

  const whySeat = asTrimmedString(body?.why_seat);
  if (!whySeat) {
    return NextResponse.json(
      { ok: false, reason: "why-required" },
      { status: 400 },
    );
  }
  if (whySeat.length > 500) {
    return NextResponse.json(
      { ok: false, reason: "why-too-long" },
      { status: 400 },
    );
  }

  const filmedBefore = asTrimmedString(body?.filmed_before);
  if (!filmedBefore) {
    return NextResponse.json(
      { ok: false, reason: "filmed-required" },
      { status: 400 },
    );
  }
  if (!FILMED_BEFORE.has(filmedBefore)) {
    return NextResponse.json(
      { ok: false, reason: "filmed-invalid" },
      { status: 400 },
    );
  }

  if (!asBool(body?.accepted_terms)) {
    return NextResponse.json(
      { ok: false, reason: "accepted_terms-required" },
      { status: 400 },
    );
  }
  if (!asBool(body?.accepted_fee)) {
    return NextResponse.json(
      { ok: false, reason: "accepted_fee-required" },
      { status: 400 },
    );
  }
  if (!asBool(body?.requested_payment_details)) {
    return NextResponse.json(
      { ok: false, reason: "requested_payment-required" },
      { status: 400 },
    );
  }

  const acceptedAt = new Date().toISOString();

  const row = {
    full_name: fullName,
    email: emailRaw,
    whatsapp,
    describes_you: describesYou,
    why_seat: whySeat,
    filmed_before: filmedBefore,
    accepted_terms: true,
    accepted_fee: true,
    requested_payment_details: true,
    accepted_at: acceptedAt,
    source: "training",
  };

  const supabase = getServiceClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, reason: "unavailable" },
        { status: 503 },
      );
    }
    notifyTrainingApplicationAsync(row);
    return NextResponse.json({ ok: true, simulated: true });
  }

  const { error } = await supabase.from("training_applications").insert(row);

  if (error) {
    console.error("[training] insert failed:", error.message);
    return NextResponse.json(
      { ok: false, reason: "server-error" },
      { status: 500 },
    );
  }

  notifyTrainingApplicationAsync(row);
  return NextResponse.json({ ok: true });
}
