import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { TREBLE_INTEREST_OPTIONS } from "@/lib/treble";

export const runtime = "nodejs";

const INTERESTS = new Set(TREBLE_INTEREST_OPTIONS);
const ROLES = new Set(["club", "host"]);

/** Same sliding window as Write to Melo: 3 submissions per IP per hour. */
const RATE_LIMIT = { windowMs: 60 * 60_000, max: 3 };
const rateMap = new Map();

const LIMITS = {
  fullName: 120,
  orgName: 160,
  clubSupported: 120,
  whatsapp: 40,
  email: 160,
  members: 100000,
};

function getClientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

function rateLimited(ip) {
  const now = Date.now();
  const hits = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  hits.push(now);
  rateMap.set(ip, hits);
  if (rateMap.size > 10_000) rateMap.clear();
  return hits.length > RATE_LIMIT.max;
}

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function asMembers(value) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function isMissingTable(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function silentOk() {
  return NextResponse.json({ ok: true });
}

function fail(reason, status = 400) {
  return NextResponse.json({ ok: false, reason }, { status });
}

function simulated() {
  console.warn(
    "[treble] treble_interest is not available yet. Returning a simulated success.",
  );
  return NextResponse.json({ ok: true, simulated: true });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("invalid-request");
  }

  if (body?.website) {
    return silentOk();
  }

  const ip = getClientIp(request);
  if (rateLimited(ip)) {
    return fail("rate-limited", 429);
  }

  const role = asTrimmedString(body?.role);
  if (!ROLES.has(role)) return fail("role-invalid");

  const fullName = asTrimmedString(body?.full_name);
  if (!fullName) return fail("full_name-required");
  if (fullName.length > LIMITS.fullName) return fail("full_name-too-long");

  const orgName = asTrimmedString(body?.org_name);
  if (!orgName) return fail("org_name-required");
  if (orgName.length > LIMITS.orgName) return fail("org_name-too-long");

  const whatsapp = asTrimmedString(body?.whatsapp);
  if (!whatsapp) return fail("whatsapp-required");
  if (whatsapp.length > LIMITS.whatsapp) return fail("whatsapp-too-long");

  const email = asTrimmedString(body?.email);
  if (!email) return fail("email-required");
  if (email.length > LIMITS.email) return fail("email-too-long");
  if (!isValidEmail(email)) return fail("email-invalid");

  if (body?.consent !== true) return fail("consent-required");

  let clubSupported = null;
  let members = null;
  let interest = null;

  if (role === "club") {
    clubSupported = asTrimmedString(body?.club_supported);
    if (!clubSupported) return fail("club_supported-required");
    if (clubSupported.length > LIMITS.clubSupported) {
      return fail("club_supported-too-long");
    }

    if (body?.members === "" || body?.members == null) {
      return fail("members-required");
    }
    members = asMembers(body?.members);
    if (members === null || members > LIMITS.members) {
      return fail("members-invalid");
    }
  } else {
    interest = asTrimmedString(body?.interest);
    if (!interest) return fail("interest-required");
    if (!INTERESTS.has(interest)) return fail("interest-invalid");
  }

  const row = {
    role,
    full_name: fullName,
    org_name: orgName,
    club_supported: clubSupported,
    members,
    interest,
    whatsapp,
    email,
    consent: true,
  };

  const supabase = getServiceClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return fail("unavailable", 503);
    }
    return simulated();
  }

  const { error } = await supabase.from("treble_interest").insert(row);

  if (error) {
    if (isMissingTable(error)) return simulated();
    console.error("[treble] insert failed:", error.message);
    return fail("server-error", 500);
  }

  return NextResponse.json({ ok: true });
}
