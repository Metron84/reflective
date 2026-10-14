import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCrestLeagues } from "@/lib/account/crest-leagues";
import { awardBadge } from "@/lib/account/badges";

export const dynamic = "force-dynamic";

/**
 * The member has revealed every Crest league. Reveals are kept in the browser, so the
 * client reports it. The server only checks the member has a saved Crest, and the
 * award is a cosmetic honour that is safe to repeat.
 */
export async function POST() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ message: "Not configured." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const result = await getCrestLeagues(supabase, user.id);
  if (!result || result.leagues.length === 0) {
    return NextResponse.json({ message: "Swipe The Crest first." }, { status: 409 });
  }
  const awarded = await awardBadge(user.id, "every_league");
  return NextResponse.json({ awarded });
}
