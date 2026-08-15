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

  const playerIds = Array.isArray(body?.player_ids) ? body.player_ids : [];
  const db = getUltimaDb();
  if (!db) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(err, { status });
  }

  await db.from("ultima_draft_queues").delete().eq("manager_id", manager.id);

  const rows = playerIds.map((playerId, i) => ({
    manager_id: manager.id,
    player_id: playerId,
    position: i + 1,
  }));

  if (rows.length) {
    await db.from("ultima_draft_queues").insert(rows);
  }

  return NextResponse.json({ ok: true });
}
