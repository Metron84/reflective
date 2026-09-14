import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeFatfRole } from "@/lib/fatf";

export const runtime = "nodejs";

export async function POST(request) {
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const skip = Boolean(body?.skip);
  const role = skip ? null : normalizeFatfRole(body?.role);
  if (!skip && !role) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ fatf_role: role })
    .eq("id", user.id)
    .eq("fatf_interest", true);

  if (error) {
    return NextResponse.json(
      { ok: false, message: "We could not save that just now. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, skipped: skip, role });
}
