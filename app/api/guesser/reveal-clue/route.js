import { NextResponse } from "next/server";
import crypto from "crypto";
import { signPayload } from "@/lib/signing";
import { gstDay } from "@/lib/guesser/config";
import { getShippableModes } from "@/lib/guesser/players";
import { getDailyAnswer } from "@/lib/guesser/engine";
import { buildClueState, maxUnlockedClue } from "@/lib/guesser/clues";
import {
  GUESSER_COOKIE,
  parseGuesserCookie,
  getGame,
  isGameOver,
  compactGameForCookie,
} from "@/lib/guesser/state";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { mode, clueNumber } = body ?? {};
  const num = Number(clueNumber);

  if (
    !getShippableModes().some((m) => m.slug === mode) ||
    !Number.isInteger(num) ||
    num < 2 ||
    num > 5
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const day = gstDay();
  const state = parseGuesserCookie(request.cookies.get(GUESSER_COOKIE)?.value, day);
  if (!state.sid) state.sid = crypto.randomUUID();
  const game = getGame(state, mode);

  if (isGameOver(game)) {
    return NextResponse.json({ ok: false, reason: "done-for-today" }, { status: 409 });
  }

  const unlocked = maxUnlockedClue(game.attempts, game.solved);
  if (num > unlocked) {
    return NextResponse.json({ ok: false, reason: "locked" }, { status: 403 });
  }

  if (!game.revealedClues.includes(num)) {
    game.revealedClues = [...game.revealedClues, num].sort((a, b) => a - b);
  }

  state.games[mode] = compactGameForCookie(game);

  const answer = await getDailyAnswer(mode, day);
  if (!answer) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const response = NextResponse.json({
    ok: true,
    clues: buildClueState(answer, game),
  });
  response.cookies.set(GUESSER_COOKIE, signPayload(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 36,
    path: "/",
  });
  return response;
}
