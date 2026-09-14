import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FATF_CONSENT_VERSION,
  FATF_SIGNUP_SOURCE,
} from "@/lib/fatf";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "We could not save that just now. Please try again." },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Sign in required." }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("fatf_interest, fatf_role")
    .eq("id", user.id)
    .maybeSingle();

  if (existing?.fatf_interest) {
    return NextResponse.json({
      ok: true,
      already: true,
      message: "You are already on the list for this one.",
      role: existing.fatf_role ?? null,
    });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      fatf_interest: true,
      fatf_interest_at: now,
      consent_wording_version: FATF_CONSENT_VERSION,
      signup_source: FATF_SIGNUP_SOURCE,
    })
    .eq("id", user.id)
    .select("fatf_interest, fatf_role")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, message: "We could not save that just now. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    already: false,
    role: data.fatf_role ?? null,
  });
}
