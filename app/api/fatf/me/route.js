import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ signedIn: false, interested: false, role: null });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, interested: false, role: null });
  }

  const { data } = await supabase
    .from("profiles")
    .select("fatf_interest, fatf_role")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    signedIn: true,
    interested: Boolean(data?.fatf_interest),
    role: data?.fatf_role ?? null,
  });
}
