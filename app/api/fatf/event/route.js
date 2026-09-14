import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { FATF_EVENTS } from "@/lib/fatf";
import { getClientIp } from "@/lib/concierge/rateLimit";

export const runtime = "nodejs";

const ALLOWED = new Set(FATF_EVENTS);
const WINDOW_MS = 60_000;
const MAX_HITS = 40;
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 10_000) hits.clear();
  return list.length > MAX_HITS;
}

export async function POST(request) {
  const ip = getClientIp(request);
  if (limited(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = typeof body?.event === "string" ? body.event : "";
  if (!ALLOWED.has(event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json({ ok: true });
  }

  let userId = null;
  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  }

  await service.from("fatf_events").insert({
    event,
    user_id: userId,
    meta: {},
  });

  return NextResponse.json({ ok: true });
}
