import "server-only";
import { getClientIp } from "@/lib/concierge/rateLimit";
import { getAuthContext } from "@/lib/auth/session";
import { playableClub } from "./access";
import { cardById } from "./clubs";
import { sendResultEmail } from "./notify";
import { db, fail, ok, readSession } from "./store";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCATIONS = new Set(["dubai", "uae-other", "uk", "elsewhere"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WINDOW_MS = 10 * 60_000;
const MAX = 20;
const hits = new Map();
const recentEmail = new Map();

function limited(request) {
  const ip = getClientIp(request);
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  if (recent.length <= MAX) return null;
  return fail("Too many tries. Wait a few minutes.", 429);
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function saveFanResult(request, clubSlug, body) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const club = await playableClub(request, clubSlug, body);
  if (!club) return fail("That club is not in the game.", 404);
  const sessionId = readSession(request);
  if (!sessionId) return fail("Start a run first.", 404);

  const email = clean(body?.email, 120).toLowerCase();
  if (!EMAIL.test(email)) return fail("Enter a valid email.");
  if (body?.consentSave !== true) return fail("Tick save my result to continue.");
  const location = body?.location ? String(body.location) : null;
  if (location && !LOCATIONS.has(location)) return fail("That place is not on the list.");
  const runId = typeof body?.runId === "string" ? body.runId : "";
  if (!UUID.test(runId)) return fail("That result is not valid.");

  const client = db();
  if (!client) return fail("The game is warming up. Try again soon.", 503);

  const { data: run, error: runError } = await client
    .from("watch_with_runs")
    .select("id, champion_id, completed_at, session_id")
    .eq("id", runId)
    .eq("session_id", sessionId)
    .eq("club_slug", clubSlug)
    .maybeSingle();
  if (runError) throw runError;
  if (!run?.completed_at || !run.champion_id) return fail("Finish the run before saving it.");

  const now = Date.now();
  const memory = recentEmail.get(email);
  if (memory && now - memory.at < 60_000) {
    return ok({ status: "saved", verified: memory.verified }, sessionId, false);
  }

  const { data: existing, error: existingError } = await client
    .from("watch_with_fans")
    .select("id, email_verified, consent_at, user_id")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.consent_at && now - new Date(existing.consent_at).getTime() < 60_000) {
    recentEmail.set(email, { at: now, verified: Boolean(existing.email_verified) });
    return ok({ status: "saved", verified: Boolean(existing.email_verified) }, sessionId, false);
  }

  const auth = await getAuthContext();
  const accountEmail = auth.isSignedIn ? String(auth.user?.email || "").toLowerCase() : "";
  const signedMatch = Boolean(accountEmail) && accountEmail === email;
  const verified = signedMatch || Boolean(existing?.email_verified);
  const row = {
    session_id: sessionId,
    user_id: signedMatch ? auth.user.id : existing?.user_id ?? null,
    email,
    first_name: clean(body?.firstName, 40) || null,
    location,
    supporters_club: clean(body?.supportersClub, 80) || null,
    email_verified: verified,
    consent_save_result: true,
    consent_marketing: body?.consentMarketing === true,
    consent_at: new Date().toISOString(),
  };

  let fanId = existing?.id ?? null;
  if (existing) {
    const { error } = await client.from("watch_with_fans").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { data, error } = await client.from("watch_with_fans").insert(row).select("id").single();
    if (error) throw error;
    fanId = data.id;
  }

  const { error: linkError } = await client
    .from("watch_with_runs")
    .update({ fan_id: fanId })
    .eq("session_id", sessionId)
    .not("completed_at", "is", null);
  if (linkError) throw linkError;

  recentEmail.set(email, { at: now, verified });
  if (!verified) {
    const champion = cardById(club, run.champion_id);
    await sendResultEmail({
      email,
      champion: champion?.name || "your companion",
      clubName: club.name,
      clubSlug: club.slug,
    });
  }
  return ok({ status: "saved", verified }, sessionId, false);
}
