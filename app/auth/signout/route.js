import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url));
}
