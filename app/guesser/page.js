import { cookies } from "next/headers";
import { puzzleNumber, MAX_ATTEMPTS, GUESSER_MODES } from "@/lib/guesser/config";
import {
  getShippableModes,
  getGuessSuggestions,
} from "@/lib/guesser/players";
import {
  getDailyAnswer,
  shareGrid,
  hydrateGameGuesses,
} from "@/lib/guesser/engine";
import { buildClueState } from "@/lib/guesser/clues";
import {
  GUESSER_COOKIE,
  parseGuesserCookie,
  getGame,
  isGameOver,
  getPlayedModes,
} from "@/lib/guesser/state";
import { getAuthContext } from "@/lib/auth/session";
import { getUserPlayedModes } from "@/lib/auth/plays";
import GuesserBoard from "@/components/guesser/GuesserBoard";

export const metadata = {
  title: "The Guesser",
  description:
    "One player a day. Guess the footballer from progressive feedback.",
};

export const dynamic = "force-dynamic";

function nextUnplayedMode(played, modes) {
  const locked = modes.filter((m) => !m.free);
  return locked.find((m) => !played.includes(m.slug))?.slug ?? null;
}

function resolveMode(slug) {
  const modes = getShippableModes();
  const found = modes.find((m) => m.slug === slug);
  if (found) return found;
  return modes.find((m) => m.slug === "classic") ?? GUESSER_MODES[0];
}

export default async function GuesserPage({ searchParams }) {
  const params = await searchParams;
  const modeConfig = resolveMode(params?.mode ?? "classic");
  const mode = modeConfig.slug;
  const { isSignedIn, user } = await getAuthContext();
  const modeLocked = !modeConfig.free && !isSignedIn;

  const store = await cookies();
  const state = parseGuesserCookie(store.get(GUESSER_COOKIE)?.value);
  const rawGame = getGame(state, mode);
  const game = modeLocked
    ? rawGame
    : await hydrateGameGuesses(mode, rawGame, state.day);
  const modes = getShippableModes();
  const answer = modeLocked ? null : await getDailyAnswer(mode, state.day);

  const gameOver = !modeLocked && isGameOver(game);
  const initialShare =
    gameOver && answer ? shareGrid(modeConfig.name, game, state.day) : null;
  const initialAnswer =
    gameOver && !game.solved && answer ? answer.name : null;
  const initialClues = answer ? buildClueState(answer, game) : null;

  const cookiePlayed = getPlayedModes(state);
  const dbPlayed = isSignedIn ? await getUserPlayedModes(user.id, state.day) : [];
  const played = [...new Set([...cookiePlayed, ...dbPlayed])];
  const nextModeSlug = nextUnplayedMode(played, modes);
  const lockedModes = modes.filter((m) => !m.free);
  const signInNext = `/guesser${params?.mode ? `?mode=${params.mode}` : ""}`;

  return (
    <div>
      <section className="bg-gradient-to-b from-navy to-navy-deep px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-paper/50">
          The Reflective Football
        </p>
        <h1 className="mt-4 font-display text-5xl text-paper sm:text-6xl">
          The Guesser
        </h1>
        <p className="mt-2 text-sm uppercase tracking-widest text-paper/50">
          {modeConfig.name}
        </p>
        <p className="mt-4 text-paper/75">
          One player a day. Six guesses. Puzzle #{puzzleNumber(state.day)}.
        </p>
      </section>

      <GuesserBoard
        mode={mode}
        modeName={modeConfig.name}
        modeLocked={modeLocked}
        openSignupOnLoad={modeLocked}
        signInNext={signInNext}
        suggestions={getGuessSuggestions(mode)}
        initialGuesses={game.guesses}
        initialSolved={game.solved}
        initialShare={initialShare}
        initialAnswer={initialAnswer}
        initialClues={initialClues}
        maxAttempts={MAX_ATTEMPTS}
        lockedModes={lockedModes}
        isSignedIn={isSignedIn}
        nextModeSlug={nextModeSlug}
      />
    </div>
  );
}
