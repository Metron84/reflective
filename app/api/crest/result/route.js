import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLUBS } from "@/lib/crest/clubs";
import { parseBallot, snapshotFromBallot } from "@/lib/crest/result-store";

function clubView(slug) {
  const club = CLUBS.find((row) => row.slug === slug);
  return {
    clubSlug: slug,
    clubName: club?.name || slug,
    clubColor: club?.color || "#D8232A",
  };
}

function publicRow(row) {
  return {
    saved: true,
    ...clubView(row.club_slug),
    roomPct: row.room_pct,
    stake: row.stake,
    scope: row.scope,
    savedAt: row.saved_at,
    answers: row.answers,
  };
}

async function currentUser() {
  const supabase = await createClient();
  if (!supabase) return { error: NextResponse.json({ message: "Not configured." }, { status: 503 }) };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ message: "Sign in required." }, { status: 401 }) };
  }
  return { supabase, user };
}

export async function GET() {
  const auth = await currentUser();
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabase
    .from("crest_results")
    .select("answers, stake, scope, club_slug, room_pct, saved_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ saved: false, message: "Save is not live yet." }, { status: 200 });
  }
  if (!data) return NextResponse.json({ saved: false });
  return NextResponse.json(publicRow(data));
}

export async function PUT(request) {
  const auth = await currentUser();
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const parsed = parseBallot(body);
  if (parsed.error) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const snap = snapshotFromBallot(parsed);
  const row = {
    user_id: auth.user.id,
    answers: parsed.answers,
    stake: parsed.stake,
    scope: parsed.scope,
    club_slug: snap.club_slug,
    room_pct: snap.room_pct,
    saved_at: new Date().toISOString(),
  };

  const { data, error } = await auth.supabase
    .from("crest_results")
    .upsert(row, { onConflict: "user_id" })
    .select("answers, stake, scope, club_slug, room_pct, saved_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "Could not save." }, { status: 500 });
  }
  return NextResponse.json(publicRow(data));
}
