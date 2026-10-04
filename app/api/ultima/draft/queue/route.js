import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getManagerForUser, getUltimaDb } from "@/lib/ultima/server/db";

export const runtime = "nodejs";

const rateMap = new Map();

function rateLimited(managerId) {
  const now = Date.now();
  const hits = (rateMap.get(managerId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  rateMap.set(managerId, hits);
  return hits.length > 30;
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const manager = await getManagerForUser(user.id);
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  if (rateLimited(manager.id)) {
    return NextResponse.json(
      { code: "RATE_LIMIT", message: "Too many queue updates." },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  // Strings only, no repeats, a sane length. The queue works in the lobby and in the draft.
  const requested = Array.isArray(body?.player_ids)
    ? [...new Set(body.player_ids.filter((id) => typeof id === "string" && id))].slice(0, 150)
    : [];
  const db = getUltimaDb();
  if (!db) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(err, { status });
  }

  // Keep only players that exist, in the order sent.
  let playerIds = requested;
  if (requested.length) {
    const { data: known, error: knownError } = await db
      .from("ultima_players")
      .select("id")
      .in("id", requested);
    if (knownError) {
      const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
      return NextResponse.json(err, { status });
    }
    const exists = new Set((known ?? []).map((row) => row.id));
    playerIds = requested.filter((id) => exists.has(id));
  }

  const { error: clearError } = await db
    .from("ultima_draft_queues")
    .delete()
    .eq("manager_id", manager.id);

  const rows = playerIds.map((playerId, i) => ({
    manager_id: manager.id,
    player_id: playerId,
    position: i + 1,
  }));

  const { error: insertError } = rows.length
    ? await db.from("ultima_draft_queues").insert(rows)
    : { error: null };

  if (clearError || insertError) {
    return NextResponse.json(
      { code: "UNAVAILABLE", message: "The queue did not save. Try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
