import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getManagerForUser, getUltimaDb } from "@/lib/ultima/server/db";
import { readQueue, saveQueue } from "@/lib/ultima/server/queue";

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

  const result = await saveQueue(manager.id, body);
  return NextResponse.json(result.body, { status: result.status });
}

// A manager reads only their own queue. Nothing in the request picks whose.
// TODO(after the draft): tighten RLS on ultima_draft_queues. The current policy lets any
// participant read every queue. The replacement must cover practice managers too, because
// ultima_current_manager_id() only resolves one manager and is not scoped to the season.
// Until then own-queue reads are enforced here and in the state routes.
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }
  const manager = await getManagerForUser(user.id);
  const db = getUltimaDb();
  if (!manager || !db) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: manager ? 503 : 403 });
    return NextResponse.json(body, { status });
  }
  const queue = await readQueue(db, manager.id);
  if (!queue) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(body, { status });
  }
  return NextResponse.json({ queue });
}
