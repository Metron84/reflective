import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revealLeague } from "@/lib/account/crest-reveals";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ message: "Not configured." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }
  const competition = typeof body?.competition === "string" ? body.competition : "";
  if (!competition) return NextResponse.json({ message: "Pick a league." }, { status: 400 });

  const result = await revealLeague(supabase, user.id, competition);
  if (result.error) return NextResponse.json({ message: result.error }, { status: result.status });
  return NextResponse.json({ revealed: result.revealed, everyLeague: result.everyLeague });
}
