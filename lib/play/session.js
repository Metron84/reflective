import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { clientIp, rateLimit } from "./rate-limit.js";

export const COOKIE = "fq_sid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "id,state,version,completed_at,claimed_by";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export const fail = (status, error, extra = {}) =>
  NextResponse.json({ error, ...extra }, { status, headers: HEADERS });

export const ok = (body) => NextResponse.json(body, { headers: HEADERS });

/** Returns a 429 response when the caller is over the limit, otherwise null. */
export function limited(req, route, limit) {
  return rateLimit(clientIp(req.headers), route, limit) ? null : fail(429, "Easy there. Try again in a moment.");
}

export function setCookie(res, id) {
  res.cookies.set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 6,
  });
  return res;
}

export const db = () => getServiceClient();
export const noDb = () => fail(503, "The game is warming up. Try again soon.");
export const noSession = () => fail(404, "Your game was not found. Start a new one.", { next: "newGame" });
export const conflict = () => fail(409, "That one was already handled. Carry on.", { next: "refresh" });

export async function loadSession(req, client = db()) {
  const id = req.cookies.get(COOKIE)?.value;
  if (!client || !id || !UUID.test(id)) return null;
  const { data } = await client.from("fan_quiz_sessions").select(COLUMNS).eq("id", id).maybeSingle();
  return data ?? null;
}

/** Single update guarded by the version we read. False means another request got there first. */
export async function saveState(row, state, completedAt, client = db()) {
  const patch = { state, version: row.version + 1 };
  if (completedAt) patch.completed_at = completedAt;
  const { data, error } = await client
    .from("fan_quiz_sessions")
    .update(patch)
    .eq("id", row.id)
    .eq("version", row.version)
    .select("id");
  return !error && !!data?.length;
}
