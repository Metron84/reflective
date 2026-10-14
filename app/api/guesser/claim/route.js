import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getUserPlayedModes } from "@/lib/auth/plays";
import { hydrateGameGuesses } from "@/lib/guesser/engine";
import { claimGuesserGames } from "@/lib/guesser/claim";
import { recordPlay } from "@/lib/guesser/record-play";
import { GUESSER_COOKIE, parseGuesserCookie } from "@/lib/guesser/state";

export const runtime = "nodejs";

/**
 * Called by the post-sign-in claim step. Reads today's games from the signed guesser cookie and
 * saves the finished ones under the signed-in member. The body is ignored.
 */
export async function POST(request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, claimed: [] }, { status: 401 });

  const state = parseGuesserCookie(request.cookies.get(GUESSER_COOKIE)?.value);
  const claimed = await claimGuesserGames({
    state,
    userId: user.id,
    deps: {
      playedModes: getUserPlayedModes,
      hydrate: hydrateGameGuesses,
      record: recordPlay,
    },
  });
  return NextResponse.json({ ok: true, claimed });
}
