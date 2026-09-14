import { NextResponse } from "next/server";
import { defaultNameFromEmail } from "@/lib/auth/config";
import { FATF_CONSENT_VERSION, FATF_SIGNUP_SOURCE } from "@/lib/fatf";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ message: "Not configured." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const skipName = Boolean(body.skipName);
  const skipClubs = Boolean(body.skipClubs);
  const marketingConsent = Boolean(body.marketingConsent);
  const clubs = skipClubs
    ? []
    : Array.isArray(body.clubs)
      ? body.clubs.filter((c) => typeof c === "string").slice(0, 12)
      : [];

  let preferredName =
    typeof body.preferredName === "string" ? body.preferredName.trim() : "";
  if (skipName || !preferredName) {
    preferredName = defaultNameFromEmail(user.email);
  }
  if (preferredName.length > 40) {
    preferredName = preferredName.slice(0, 40);
  }

  const fatfInterest = Boolean(body.fatfInterest);
  if (fatfInterest && !Boolean(body.fatfConsent)) {
    return NextResponse.json(
      { message: "Please agree so we can email you about the nights." },
      { status: 400 },
    );
  }
  if (fatfInterest && !Boolean(body.ageAttested)) {
    return NextResponse.json(
      { message: "You need to be 18 or over for this." },
      { status: 400 },
    );
  }

  const patch = {
    preferred_name: preferredName,
    clubs,
    marketing_consent: marketingConsent,
    welcome_completed: true,
  };
  if (fatfInterest) {
    patch.fatf_interest = true;
    patch.fatf_interest_at = new Date().toISOString();
    patch.consent_wording_version = FATF_CONSENT_VERSION;
    patch.signup_source = FATF_SIGNUP_SOURCE;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("preferred_name, member_number")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "Could not save profile." }, { status: 500 });
  }

  return NextResponse.json({
    preferredName: data.preferred_name,
    memberNumber: data.member_number,
  });
}
