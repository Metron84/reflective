import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import {
  claimYourSaySubmission,
  getClientIp,
  handoffRateLimited,
  releaseYourSaySubmission,
  yourSayCoolingDown,
  yourSaySubmitterHash,
} from "@/lib/concierge/rateLimit";
import { notifyConciergeMessageAsync } from "@/lib/concierge/notify";
import { verifyHandoffTimingToken } from "@/lib/concierge/handoffTiming";
import { YOUR_SAY_COOKIE, YOUR_SAY_COOLDOWN_SECONDS } from "@/lib/your-say";

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

function cooldownResponse() {
  return NextResponse.json({ ok: false, reason: "cooldown" }, { status: 429 });
}

function withYourSayCookie(response) {
  response.cookies.set({
    name: YOUR_SAY_COOKIE,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/your-say",
    maxAge: YOUR_SAY_COOLDOWN_SECONDS,
  });
  return response;
}

async function yourSayStoredRecently(supabase, hash) {
  if (!supabase || !hash) return false;
  const since = new Date(Date.now() - YOUR_SAY_COOLDOWN_SECONDS * 1000).toISOString();
  const { data, error } = await supabase
    .from("concierge_messages")
    .select("id")
    .eq("source", "your-say")
    .eq("submitter_hash", hash)
    .gte("created_at", since)
    .limit(1);

  if (error) {
    console.error("[concierge/handoff] your-say cooldown check failed:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
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

  const source = typeof body?.source === "string" ? body.source.trim() : "";
  const isYourSay = source === "your-say";
  const ip = getClientIp(request);
  const yourSayHash = isYourSay ? yourSaySubmitterHash(ip) : null;

  if (
    isYourSay &&
    (yourSayCoolingDown(ip) ||
      (await yourSayStoredRecently(getServiceClient(), yourSayHash)))
  ) {
    return cooldownResponse();
  }

  // Layer 3: handoff-only rate limit (3 / IP / hour)
  if (handoffRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429 }
    );
  }

  let supportersClub = "";
  let publishConsent = false;

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ ok: false, reason: "message-required" }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ ok: false, reason: "message-too-long" }, { status: 400 });
  }

  const nameRaw = typeof body?.name === "string" ? body.name.trim() : "";
  if (!nameRaw) {
    return NextResponse.json({ ok: false, reason: "name-required" }, { status: 400 });
  }
  if (nameRaw.length > 100) {
    return NextResponse.json({ ok: false, reason: "name-too-long" }, { status: 400 });
  }
  const name = nameRaw.slice(0, 100);

  let topic = "";
  let email = null;

  if (isYourSay) {
    const clubRaw =
      typeof body?.supportersClub === "string" ? body.supportersClub.trim() : "";
    if (!clubRaw) {
      return NextResponse.json({ ok: false, reason: "club-required" }, { status: 400 });
    }
    if (clubRaw.length > 120) {
      return NextResponse.json({ ok: false, reason: "club-too-long" }, { status: 400 });
    }
    supportersClub = clubRaw.slice(0, 120);
    publishConsent = body?.publishConsent === true;
    topic = "Your Say";
  } else {
    topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    if (!TOPICS.has(topic)) {
      return NextResponse.json({ ok: false, reason: "invalid-topic" }, { status: 400 });
    }

    const emailRaw =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!emailRaw) {
      return NextResponse.json({ ok: false, reason: "email-required" }, { status: 400 });
    }
    if (emailRaw.length > 200) {
      return NextResponse.json({ ok: false, reason: "email-too-long" }, { status: 400 });
    }
    if (!isValidEmail(emailRaw)) {
      return NextResponse.json({ ok: false, reason: "invalid-email" }, { status: 400 });
    }
    email = emailRaw.slice(0, 200);
  }

  if (isYourSay && !claimYourSaySubmission(ip)) {
    return cooldownResponse();
  }

  const sourceConversation = isYourSay
    ? []
    : Array.isArray(body?.source_conversation)
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
      if (isYourSay) releaseYourSaySubmission(ip);
      return NextResponse.json({ ok: false, reason: "unavailable" }, { status: 503 });
    }
    const simulated = NextResponse.json({ ok: true, simulated: true });
    return isYourSay ? withYourSayCookie(simulated) : simulated;
  }

  const insert = {
    name,
    email,
    topic,
    message,
    source_conversation: sourceConversation,
    status: "new",
  };
  if (isYourSay) {
    insert.source = "your-say";
    insert.supporters_club = supportersClub;
    insert.publish_consent = publishConsent;
    if (yourSayHash) insert.submitter_hash = yourSayHash;
  }

  const { data: row, error } = await supabase
    .from("concierge_messages")
    .insert(insert)
    .select("id, created_at")
    .maybeSingle();

  if (error) {
    if (isYourSay) releaseYourSaySubmission(ip);
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }

  notifyConciergeMessageAsync({
    topic,
    name,
    email,
    message,
    createdAt: row?.created_at ?? new Date().toISOString(),
    supportersClub: isYourSay ? supportersClub : undefined,
    publishConsent: isYourSay ? publishConsent : undefined,
    subject: isYourSay ? `Your Say: ${supportersClub} · ${name}` : undefined,
  });

  const ok = NextResponse.json({ ok: true });
  return isYourSay ? withYourSayCookie(ok) : ok;
}
