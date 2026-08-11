import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { notifyLaligaInterestAsync } from "@/lib/laliga/notify";
import {
  BEST_DAY_OPTIONS,
  FREQUENCY_OPTIONS,
  GROUP_SIZE_OPTIONS,
  LALIGA_CLUBS,
} from "@/lib/laliga/options";

export const runtime = "nodejs";

const CLUBS = new Set(LALIGA_CLUBS);
const FREQUENCIES = new Set(FREQUENCY_OPTIONS);
const GROUP_SIZES = new Set(GROUP_SIZE_OPTIONS);
const BEST_DAYS = new Set(BEST_DAY_OPTIONS);

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

  const firstName = asTrimmedString(body?.first_name);
  if (!firstName) {
    return NextResponse.json(
      { ok: false, reason: "first_name-required" },
      { status: 400 },
    );
  }
  if (firstName.length > 100) {
    return NextResponse.json(
      { ok: false, reason: "first_name-too-long" },
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

  const club = asTrimmedString(body?.club);
  if (!club) {
    return NextResponse.json(
      { ok: false, reason: "club-required" },
      { status: 400 },
    );
  }
  if (!CLUBS.has(club)) {
    return NextResponse.json(
      { ok: false, reason: "club-invalid" },
      { status: 400 },
    );
  }

  const frequency = asTrimmedString(body?.frequency);
  if (!frequency || !FREQUENCIES.has(frequency)) {
    return NextResponse.json(
      { ok: false, reason: "frequency-required" },
      { status: 400 },
    );
  }

  const groupSize = asTrimmedString(body?.group_size);
  if (!groupSize || !GROUP_SIZES.has(groupSize)) {
    return NextResponse.json(
      { ok: false, reason: "group_size-required" },
      { status: 400 },
    );
  }

  const bestDay = asTrimmedString(body?.best_day);
  if (!bestDay || !BEST_DAYS.has(bestDay)) {
    return NextResponse.json(
      { ok: false, reason: "best_day-required" },
      { status: 400 },
    );
  }

  const missMostRaw = asTrimmedString(body?.miss_most);
  if (missMostRaw.length > 2000) {
    return NextResponse.json(
      { ok: false, reason: "miss_most-too-long" },
      { status: 400 },
    );
  }
  const missMost = missMostRaw || null;
  const row = {
    first_name: firstName,
    whatsapp,
    club,
    frequency,
    group_size: groupSize,
    best_day: bestDay,
    miss_most: missMost,
    contact_ok: asBool(body?.contact_ok),
    filming_ok: asBool(body?.filming_ok),
    source: "instagram",
  };

  const supabase = getServiceClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, reason: "unavailable" },
        { status: 503 },
      );
    }
    notifyLaligaInterestAsync(row);
    return NextResponse.json({ ok: true, simulated: true });
  }

  const { error } = await supabase.from("laliga_interest").insert(row);

  if (error) {
    return NextResponse.json(
      { ok: false, reason: "server-error" },
      { status: 500 },
    );
  }

  notifyLaligaInterestAsync(row);
  return NextResponse.json({ ok: true });
}
