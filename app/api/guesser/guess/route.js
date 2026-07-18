import { NextResponse } from "next/server";
import crypto from "crypto";
import { signPayload, saltedHash } from "@/lib/signing";
import { getServiceClient } from "@/lib/supabase";
import { getSessionUser } from "@/lib/auth/session";
import { getUserGameProgress } from "@/lib/auth/plays";
import { gstDay, MAX_ATTEMPTS } from "@/lib/guesser/config";
import {
  getShippableModes,
  resolveSubmission,
} from "@/lib/guesser/players";
import {
  getDailyAnswer,
  compareToAnswer,
  isSolved,
  shareGrid,
  hydrateGameGuesses,
} from "@/lib/guesser/engine";
import { buildClueState } from "@/lib/guesser/clues";
import {
  buildGuessedPersonIdSet,
  isPersonAlreadyGuessed,
} from "@/lib/guesser/dedupe";
import {
  GUESSER_COOKIE,
  parseGuesserCookie,
  getGame,
  mergeGameProgress,
  cookieGuessPersonIds,
  isGameOver,
  compactGameForCookie,
} from "@/lib/guesser/state";

export const runtime = "nodejs";

async function recordPlay(state, mode, game, userId = null) {
  const supabase = getServiceClient();
  if (!supabase) return;
  if (!userId && !state.sid) return;

  const row = {
    puzzle_date: state.day,
    mode,
    guesses: {
      rows: game.guesses,
      revealedClues: game.revealedClues ?? [],
    },
    solved: game.solved,
    attempts: game.attempts,
    user_id: userId,
    session_hash: userId ? null : saltedHash(state.sid),
  };

  const conflict = userId
    ? "user_id,puzzle_date,mode"
    : "session_hash,puzzle_date,mode";

  await supabase
    .from("plays")
    .upsert(row, { onConflict: conflict, ignoreDuplicates: false })
    .then(() => {}, () => {});
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const { mode, guess, personId } = body ?? {};

    const modeConfig = getShippableModes().find((m) => m.slug === mode);
    if (
      !modeConfig ||
      typeof guess !== "string" ||
      guess.length > 80 ||
      (personId != null && typeof personId !== "string")
    ) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const user = await getSessionUser();
    const userId = user?.id ?? null;
    if (!modeConfig.free && !userId) {
      return NextResponse.json(
        { ok: false, reason: "account-required" },
        { status: 403 }
      );
    }

    const day = gstDay();
    const state = parseGuesserCookie(
      request.cookies.get(GUESSER_COOKIE)?.value,
      day
    );
    if (!state.sid) state.sid = crypto.randomUUID();

    const dbProgress = userId
      ? await getUserGameProgress(userId, mode, day)
      : { guessPersonIds: [] };
    const cookieGame = getGame(state, mode);
    const game = mergeGameProgress(cookieGame, dbProgress);

    if (isGameOver(game)) {
      return NextResponse.json(
        { ok: false, reason: "done-for-today" },
        { status: 409 }
      );
    }

    const resolved = resolveSubmission(mode, { guess, personId });
    if (resolved.type === "none") {
      return NextResponse.json(
        { ok: false, reason: "unknown-player" },
        { status: 422 }
      );
    }
    if (resolved.type === "ambiguous") {
      return NextResponse.json(
        {
          ok: false,
          reason: "ambiguous",
          options: resolved.options.map((o) => ({
            personId: o.person.personId,
            name: o.person.name,
            context: [
              o.row.nationality,
              o.row.era_start && o.row.era_end
                ? `${o.row.era_start}-${o.row.era_end}`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
          })),
        },
        { status: 422 }
      );
    }

    const { person, row: guessedRow } = resolved;
    const guessedKeys = buildGuessedPersonIdSet(mode, day, {
      cookiePersonIds: cookieGuessPersonIds(state, mode),
      dbPersonIds: dbProgress.guessPersonIds ?? [],
    });

    if (isPersonAlreadyGuessed(mode, day, person.personId, guessedKeys)) {
      return NextResponse.json(
        { ok: false, reason: "already-guessed" },
        { status: 422 }
      );
    }

    const answer = await getDailyAnswer(mode, day);
    if (!answer) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }

    const feedback = compareToAnswer(guessedRow, answer.row);
    game.guesses.push({
      personId: person.personId,
      name: person.name,
      feedback,
    });
    game.attempts += 1;
    game.solved = isSolved(person.personId, answer.personId);

    state.games[mode] = compactGameForCookie(game);
    const gameOver = isGameOver(game);
    const hydrated = gameOver ? await hydrateGameGuesses(mode, game, day) : game;

    if (userId) {
      await recordPlay(state, mode, hydrated, userId);
    } else if (gameOver) {
      await recordPlay(state, mode, hydrated, null);
    }

    const response = NextResponse.json({
      ok: true,
      personId: person.personId,
      name: person.name,
      feedback,
      solved: game.solved,
      attempts: game.attempts,
      maxAttempts: MAX_ATTEMPTS,
      gameOver,
      clues: buildClueState(answer, game),
      share: gameOver ? shareGrid(modeConfig.name, hydrated, day) : null,
      answer: gameOver && !game.solved ? answer.name : null,
    });
    response.cookies.set(GUESSER_COOKIE, signPayload(state), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 36,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[TRF guesser]", err);
    return NextResponse.json(
      { ok: false, reason: "server-error" },
      { status: 500 }
    );
  }
}
