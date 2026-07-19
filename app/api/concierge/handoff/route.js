import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import {
  getClientIp,
  handoffRateLimited,
} from "@/lib/concierge/rateLimit";
import { notifyConciergeMessageAsync } from "@/lib/concierge/notify";
import { verifyHandoffTimingToken } from "@/lib/concierge/handoffTiming";

export const runtime = "nodejs";

const TOPICS = new Set([
  "Partnership",
  "Supporters Club",
  "Content idea",
  "Other",
]);

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Silent success used for honeypot / timing spam — no insert, no email. */
function silentOk() {
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid-request" }, { status: 400 });
  }

  // Layer 1: honeypot
  if (body?.website) {
    return silentOk();
  }

  // Layer 2: signed timing token (invalid / too-fast / expired → silent ok)
  const timing = verifyHandoffTimingToken(body?.timingToken);
  if (!timing.ok) {
    return silentOk();
  }

  // Layer 3: handoff-only rate limit (3 / IP / hour)
  const ip = getClientIp(request);
  if (handoffRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429 }
    );
  }

  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ ok: false, reason: "message-required" }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ ok: false, reason: "message-too-long" }, { status: 400 });
  }

  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  if (!TOPICS.has(topic)) {
    return NextResponse.json({ ok: false, reason: "invalid-topic" }, { status: 400 });
  }

  const name =
    typeof body?.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 120)
      : null;

  let email = null;
  if (typeof body?.email === "string" && body.email.trim()) {
    const trimmed = body.email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      return NextResponse.json({ ok: false, reason: "invalid-email" }, { status: 400 });
    }
    email = trimmed.slice(0, 254);
  }

  const sourceConversation = Array.isArray(body?.source_conversation)
    ? body.source_conversation
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
        .slice(-40)
        .map((m) => ({
          role: m.role,
          content: m.content.slice(0, 4000),
        }))
    : [];

  const supabase = getServiceClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, simulated: true });
  }

  const { data: row, error } = await supabase
    .from("concierge_messages")
    .insert({
      name,
      email,
      topic,
      message,
      source_conversation: sourceConversation,
      status: "new",
    })
    .select("id, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }

  notifyConciergeMessageAsync({
    topic,
    name,
    email,
    message,
    createdAt: row?.created_at ?? new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
