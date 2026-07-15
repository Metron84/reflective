import { NextResponse } from "next/server";
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

  const preferredName =
    typeof body.preferredName === "string" ? body.preferredName.trim() : "";
  if (!preferredName || preferredName.length > 40) {
    return NextResponse.json({ message: "Enter a valid name." }, { status: 400 });
  }

  const clubs = Array.isArray(body.clubs)
    ? body.clubs.filter((c) => typeof c === "string").slice(0, 12)
    : [];

  const { error } = await supabase
    .from("profiles")
    .update({
      preferred_name: preferredName,
      clubs,
      marketing_consent: Boolean(body.marketingConsent),
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ message: "Could not save." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
