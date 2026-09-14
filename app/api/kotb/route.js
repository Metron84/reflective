import { NextResponse } from "next/server";
import { getClientIp, handoffRateLimited } from "@/lib/concierge/rateLimit";
import { KOTB_ENABLED } from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalInt(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return undefined;
  return n;
}

function asRequiredBool(value) {
  if (value === true || value === false) return value;
  return null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function silentOk() {
  return NextResponse.json({ ok: true });
}

function fail(reason, status = 400) {
  return NextResponse.json({ ok: false, reason }, { status });
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

  if (!KOTB_ENABLED) {
    return fail("unavailable", 503);
  }

  const ip = getClientIp(request);
  if (handoffRateLimited(ip)) {
    return fail("rate-limited", 429);
  }

  const venueName = asTrimmedString(body?.venue_name);
  if (!venueName) return fail("venue_name-required");
  if (venueName.length > 160) return fail("venue_name-too-long");

  const area = asTrimmedString(body?.area);
  if (!area) return fail("area-required");
  if (area.length > 120) return fail("area-too-long");

  const outletCount = asOptionalInt(body?.outlet_count);
  if (outletCount === undefined) return fail("invalid-request");

  const contactName = asTrimmedString(body?.contact_name);
  if (!contactName) return fail("contact_name-required");
  if (contactName.length > 120) return fail("contact_name-too-long");

  const contactRole = asTrimmedString(body?.contact_role);
  if (contactRole.length > 80) return fail("invalid-request");

  const contactEmail = asTrimmedString(body?.contact_email);
  if (!contactEmail) return fail("contact_email-required");
  if (contactEmail.length > 160) return fail("invalid-request");
  if (!isValidEmail(contactEmail)) return fail("contact_email-invalid");

  const contactMobile = asTrimmedString(body?.contact_mobile);
  if (!contactMobile) return fail("contact_mobile-required");
  if (contactMobile.length > 40) return fail("contact_mobile-too-long");

  const instagramHandle = asTrimmedString(body?.instagram_handle).replace(
    /^@/,
    "",
  );
  if (instagramHandle.length > 80) return fail("invalid-request");

  const instagramFollowers = asOptionalInt(body?.instagram_followers);
  if (instagramFollowers === undefined) return fail("invalid-request");

  const burgerName = asTrimmedString(body?.burger_name);
  if (!burgerName) return fail("burger_name-required");
  if (burgerName.length > 160) return fail("burger_name-too-long");

  const why = asTrimmedString(body?.why_it_should_win);
  if (why.length > 2000) return fail("invalid-request");

  const isHalal = asRequiredBool(body?.is_halal);
  if (isHalal === null) return fail("is_halal-required");

  const showsLiveFootball = asRequiredBool(body?.shows_live_football);
  if (showsLiveFootball === null) return fail("shows_live_football-required");

  const screenCount = asOptionalInt(body?.screen_count);
  if (screenCount === undefined) return fail("invalid-request");

  const matchdayFootfall = asOptionalInt(body?.matchday_footfall);
  if (matchdayFootfall === undefined) return fail("invalid-request");

  const canHostWeekendShoot = asRequiredBool(body?.can_host_weekend_shoot);
  if (canHostWeekendShoot === null) {
    return fail("can_host_weekend_shoot-required");
  }

  const availabilityNotes = asTrimmedString(body?.availability_notes);
  if (availabilityNotes.length > 2000) return fail("invalid-request");

  const whatWinningMeans = asTrimmedString(body?.what_winning_means);
  if (whatWinningMeans.length > 2000) return fail("invalid-request");

  if (body?.contact_ok !== true) return fail("contact_ok-required");
  if (body?.filming_ok !== true) return fail("filming_ok-required");

  const row = {
    venue_name: venueName,
    area,
    outlet_count: outletCount,
    contact_name: contactName,
    contact_role: contactRole || null,
    contact_email: contactEmail,
    contact_mobile: contactMobile,
    instagram_handle: instagramHandle || null,
    instagram_followers: instagramFollowers,
    burger_name: burgerName,
    why_it_should_win: why || null,
    is_halal: isHalal,
    shows_live_football: showsLiveFootball,
    screen_count: screenCount,
    matchday_footfall: matchdayFootfall,
    can_host_weekend_shoot: canHostWeekendShoot,
    availability_notes: availabilityNotes || null,
    what_winning_means: whatWinningMeans || null,
  };

  const supabase = getServiceClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return fail("unavailable", 503);
    }
    return NextResponse.json({ ok: true, simulated: true });
  }

  const { error } = await supabase.from("kotb_applications").insert(row);

  if (error) {
    console.error("[kotb] insert failed:", error.message);
    return fail("server-error", 500);
  }

  return NextResponse.json({ ok: true });
}
