import { NextResponse } from "next/server";
import { defaultNameFromEmail } from "@/lib/auth/config";
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

  const { data, error } = await supabase
    .from("profiles")
    .update({
      preferred_name: preferredName,
      clubs,
      marketing_consent: marketingConsent,
      welcome_completed: true,
    })
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
