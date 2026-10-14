import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getUserPlayedModes } from "@/lib/auth/plays";
import { dubaiDay } from "@/lib/play/week.js";
import { hydrateGameGuesses } from "@/lib/guesser/engine";
import { claimGuesserGames } from "@/lib/guesser/claim";
import { recordPlay } from "@/lib/guesser/record-play";
import { GUESSER_COOKIE, parseGuesserCookie } from "@/lib/guesser/state";
import { claimBuzzerRun, createStore, sidHash } from "@/lib/guesser/buzzer/store";

export const runtime = "nodejs";

/**
 * Called by the post-sign-in claim step. Moves today's signed-out buzzer board (found through the
 * session id in the signed guesser cookie) to the signed-in member. Any finished league boards still
 * in the cookie from before the buzzer format are saved too. The body is ignored.
 */
export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, claimed: [] }, { status: 401 });

  const day = dubaiDay();
  const state = parseGuesserCookie(request.cookies.get(GUESSER_COOKIE)?.value, day);
  const claimed = [];

  try {
    const board = await claimBuzzerRun(createStore(), { userId: user.id, hash: sidHash(state.sid), day });
    if (board.claimed) claimed.push("buzzer");
  } catch (err) {
    console.error("[TRF guesser claim]", err);
  }

  const modes = await claimGuesserGames({
    state,
    userId: user.id,
    deps: { playedModes: getUserPlayedModes, hydrate: hydrateGameGuesses, record: recordPlay },
  });
  claimed.push(...modes);

  return NextResponse.json({ ok: true, claimed });
}
