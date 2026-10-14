import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { dubaiDay } from "@/lib/play/week.js";
import { puzzleNumber } from "@/lib/guesser/config";
import { signPayload } from "@/lib/signing";
import { getPerson } from "@/lib/guesser/registry";
import { GUESSER_COOKIE, parseGuesserCookie } from "@/lib/guesser/state";
import { runAction } from "@/lib/guesser/buzzer/board";
import { getDailyIds } from "@/lib/guesser/buzzer/daily";
import { cluesFor, nameFor, resolveGuessText } from "@/lib/guesser/buzzer/pool";
import { createStore, sidHash } from "@/lib/guesser/buzzer/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["state", "start", "buzz", "answer"]);

async function handle(request, action, body) {
  const day = dubaiDay();
  const user = await getSessionUser();
  const cookie = parseGuesserCookie(request.cookies.get(GUESSER_COOKIE)?.value, day);

  // A signed-out player needs a session id to keep their board. Give one when they start.
  let sid = cookie.sid;
  let newCookie = false;
  if (!user && !sid && action === "start") {
    sid = crypto.randomUUID();
    newCookie = true;
  }

  const result = await runAction(
    { action, body },
    {
      store: createStore(),
      userId: user?.id ?? null,
      hash: sidHash(sid),
      day,
      now: () => Date.now(),
      ids: await getDailyIds(day),
      cluesFor,
      nameFor,
      number: puzzleNumber(day),
      resolveText: resolveGuessText,
      personExists: (id) => Boolean(getPerson(id)),
    },
  );

  const response = NextResponse.json(
    { ...result.body, signedIn: Boolean(user) },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
  if (newCookie) {
    response.cookies.set(GUESSER_COOKIE, signPayload({ day, sid, games: cookie.games }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 36,
      path: "/",
    });
  }
  return response;
}

export async function GET(request) {
  try {
    return await handle(request, "state", {});
  } catch (err) {
    console.error("[TRF guesser board]", err);
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request" }, { status: 400 });
  }
  const action = typeof body?.action === "string" ? body.action : "";
  if (!ACTIONS.has(action)) return NextResponse.json({ ok: false, reason: "bad-action" }, { status: 400 });
  try {
    return await handle(request, action, body);
  } catch (err) {
    console.error("[TRF guesser board]", err);
    return NextResponse.json({ ok: false, reason: "server-error" }, { status: 500 });
  }
}
