import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCrestLeagues } from "@/lib/account/crest-leagues";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ message: "Not configured." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const result = await getCrestLeagues(supabase, user.id);
  if (!result) return NextResponse.json({ saved: false, leagues: [] });

  // The saved_at stamp is the version: a re-swipe changes it and the client refetches.
  const etag = `"crest-leagues-${result.savedAt}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json({ saved: true, savedAt: result.savedAt, leagues: result.leagues }, { headers });
}
