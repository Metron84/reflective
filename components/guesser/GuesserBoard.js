"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ClueLadder from "./ClueLadder";
import GuessInput from "./GuessInput";
import GuesserSignupPopup from "./GuesserSignupPopup";
import {
  explainTile,
  HOWTO_EXAMPLE,
  LEGEND_ARROW_COPY,
  SHARE_SYMBOL_COPY,
} from "@/lib/guesser/tile-explain";
import ClubTile, { HowToClubChips } from "./ClubTile";

const TILE_STYLES = {
  correct: "bg-emerald-600 text-white",
  close: "bg-amber-400 text-navy",
  wrong: "bg-navy-deep text-paper/60 border border-paper/10",
  na: "bg-navy-deep text-paper/40 border border-paper/10",
};

const COLUMNS = [
  { key: "nationality", label: "Nation", short: "Nat" },
  { key: "league", label: "League", short: "Lge" },
  { key: "club", label: "Club", short: "Club" },
  { key: "position", label: "Position", short: "Pos" },
  { key: "birth_year", label: "Born", short: "Born" },
  { key: "shirt_number", label: "Shirt", short: "Shirt" },
];

const HOWTO_SEEN_KEY = "trf_guesser_howto";

function StandardTile({ feedback, animate, column }) {
  const [tipOpen, setTipOpen] = useState(false);
  const arrow =
    feedback.hint === "up" ? "\u2191" : feedback.hint === "down" ? "\u2193" : "";
  const explanation = explainTile(feedback);

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setTipOpen((v) => !v)}
        onMouseEnter={() => setTipOpen(true)}
        onMouseLeave={() => setTipOpen(false)}
        aria-expanded={tipOpen}
        aria-label={explanation}
        className={`flex aspect-[4/5] min-h-[48px] w-full min-w-0 flex-col items-center justify-center rounded-sm px-0.5 py-1 text-center sm:min-h-[56px] sm:rounded ${
          TILE_STYLES[feedback.status]
        } ${animate ? "tile-flip" : ""}`}
        style={animate ? { animationDelay: `${column * 200}ms` } : undefined}
      >
        <span className="w-full truncate text-[9px] font-semibold leading-tight sm:text-xs">
          {feedback.value ?? "\u2013"}
          {arrow ? <span className="ml-px">{arrow}</span> : null}
        </span>
      </button>
      {tipOpen ? (
        <p className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-max max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 rounded border border-paper/20 bg-navy-deep px-2 py-1.5 text-[10px] leading-snug text-paper/90 shadow-lg sm:text-xs">
          {explanation}
        </p>
      ) : null}
    </div>
  );
}

function Tile({ feedback, animate, column }) {
  if (feedback.key === "club") {
    return <ClubTile feedback={feedback} animate={animate} column={column} />;
  }
  return <StandardTile feedback={feedback} animate={animate} column={column} />;
}

function HowToExample() {
  const styles = {
    correct: "bg-emerald-600 text-white",
    close: "bg-amber-400 text-navy",
    wrong: "bg-navy-deep text-paper/60 border border-paper/10",
  };
  return (
    <div className="rounded border border-paper/10 bg-navy-deep/40 p-4">
      <p className="text-xs uppercase tracking-widest text-paper/45">
        Worked example
      </p>
      <p className="mt-2 text-sm text-paper/80">
        You guessed{" "}
        <span className="font-semibold text-paper">{HOWTO_EXAMPLE.guessName}</span>
        . The answer was{" "}
        <span className="font-semibold text-paper">{HOWTO_EXAMPLE.answerName}</span>
        .
      </p>
      <p className="mt-3 truncate text-xs font-medium text-paper">
        {HOWTO_EXAMPLE.guessName}
      </p>
      <div className="mt-1 grid grid-cols-6 gap-0.5 sm:gap-1">
        {HOWTO_EXAMPLE.tiles.map((t) => (
          <div key={t.label} className="min-w-0 text-center">
            <p className="mb-0.5 truncate text-[7px] uppercase text-paper/40 sm:text-[8px]">
              {t.label}
            </p>
            {t.chips ? (
              <HowToClubChips chips={t.chips} compact />
            ) : (
              <div
                className={`rounded px-0.5 py-1 text-[9px] font-semibold sm:text-[10px] ${styles[t.status]}`}
              >
                {t.value}
              </div>
            )}
            <p className="mt-1 hidden text-[9px] leading-tight text-paper/55 sm:block">
              {t.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ open, onToggle }) {
  return (
    <div className="mb-5 rounded border border-paper/15 bg-navy-deep/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-medium uppercase tracking-widest text-paper/70 hover:text-paper"
      >
        How to play
        <span aria-hidden>{open ? "\u2212" : "+"}</span>
      </button>
      {open ? (
        <div className="space-y-4 px-4 pb-4 text-sm text-paper/75">
          <p>
            Read the opening clue, then guess the player in six tries. Each tile
            grades one attribute of your guess.
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded bg-emerald-600" />
              Green means an exact match for that column.
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded bg-amber-400" />
              Amber means close. The rules differ per column.
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 rounded border border-paper/30 bg-navy-deep" />
              Navy means wrong. A dash means not recorded.
            </li>
          </ul>
          <ul className="space-y-1.5 text-xs text-paper/60">
            {LEGEND_ARROW_COPY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="text-xs text-paper/60">{SHARE_SYMBOL_COPY}</p>
          <HowToExample />
        </div>
      ) : null}
    </div>
  );
}

export default function GuesserBoard({
  mode,
  modeName,
  modeLocked = false,
  suggestions,
  initialGuesses,
  initialSolved,
  initialShare,
  initialAnswer,
  initialClues,
  maxAttempts,
  lockedModes,
  isSignedIn = false,
  nextModeSlug = null,
  signInNext = "/signin?next=/guesser",
  openSignupOnLoad = false,
}) {
  const inputRef = useRef(null);
  const [guesses, setGuesses] = useState(initialGuesses);
  const [solved, setSolved] = useState(initialSolved);
  const [answer, setAnswer] = useState(initialAnswer);
  const [share, setShare] = useState(initialShare);
  const [clues, setClues] = useState(initialClues);
  const [pending, setPending] = useState(false);
  const [pendingClue, setPendingClue] = useState(null);
  const [notice, setNotice] = useState(null);
  const [copied, setCopied] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [animateRow, setAnimateRow] = useState(-1);
  const [signupOpen, setSignupOpen] = useState(openSignupOnLoad || modeLocked);

  const gameOver = solved || guesses.length >= maxAttempts;
  const inputDisabled = modeLocked || gameOver;

  useEffect(() => {
    if (!localStorage.getItem(HOWTO_SEEN_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLegendOpen(true);
      localStorage.setItem(HOWTO_SEEN_KEY, "1");
    }
  }, []);

  async function revealClue(clueNumber) {
    if (pendingClue || gameOver || modeLocked) return;
    setPendingClue(clueNumber);
    try {
      const res = await fetch("/api/guesser/reveal-clue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, clueNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.clues) setClues(data.clues);
    } finally {
      setPendingClue(null);
    }
  }

  async function submitGuess({ guess, personId }) {
    if (pending || inputDisabled || !guess.trim()) return;
    setPending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/guesser/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, guess: guess.trim(), personId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAnimateRow(guesses.length);
        setGuesses([
          ...guesses,
          {
            personId: data.personId,
            name: data.name,
            feedback: data.feedback,
          },
        ]);
        setSolved(data.solved);
        if (data.clues) setClues(data.clues);
        if (data.share) setShare(data.share);
        if (data.answer) setAnswer(data.answer);
        inputRef.current?.clear();
      } else if (data.reason === "ambiguous" && data.options?.length) {
        inputRef.current?.showDisambiguation(data.options);
      } else if (data.reason === "unknown-player") {
        setNotice("No match in this pool. Try a surname or pick from the list.");
      } else if (data.reason === "already-guessed") {
        setNotice("You already guessed that player.");
      } else if (data.reason === "done-for-today") {
        setNotice("Today's game is done. Back tomorrow at midnight GST.");
      } else if (data.reason === "account-required") {
        setSignupOpen(true);
      } else {
        setNotice("Couldn't process your guess — try again.");
      }
    } catch {
      setNotice("Couldn't process your guess — try again.");
    } finally {
      setPending(false);
    }
  }

  async function copyShare() {
    if (!share) return;
    if (navigator.share) {
      try {
        await navigator.share({ text: share });
        return;
      } catch {
        // clipboard fallback
      }
    }
    await navigator.clipboard.writeText(share);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function playNextBoard() {
    if (isSignedIn && nextModeSlug) {
      window.location.href = `/guesser?mode=${nextModeSlug}`;
      return;
    }
    setSignupOpen(true);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="overflow-x-hidden border border-navy/20 bg-navy p-4 sm:p-8">
        <Legend open={legendOpen} onToggle={() => setLegendOpen((v) => !v)} />

        {modeLocked ? (
          <p className="mb-6 rounded border border-paper/15 bg-navy-deep/50 px-4 py-3 text-sm text-paper/75">
            {modeName} is for members. Sign up free to play today&apos;s board
            and save your streak.
          </p>
        ) : (
          <ClueLadder
            opening={clues?.opening}
            chips={clues?.chips ?? []}
            onReveal={revealClue}
            pendingClue={pendingClue}
          />
        )}

        {!inputDisabled ? (
          <GuessInput
            ref={inputRef}
            suggestions={suggestions}
            disabled={inputDisabled}
            pending={pending}
            onSubmit={submitGuess}
          />
        ) : null}

        {notice ? <p className="mt-3 text-sm text-amber-400">{notice}</p> : null}

        <p className="mt-5 text-xs uppercase tracking-widest text-paper/50">
          {guesses.length} of {maxAttempts} guesses
        </p>

        <div className="mt-3 [perspective:600px]">
          <div className="grid grid-cols-6 gap-0.5 sm:gap-1.5">
            {COLUMNS.map((col) => (
              <p
                key={col.key}
                className="truncate text-center text-[7px] uppercase tracking-wide text-paper/50 sm:text-[10px] sm:tracking-wider"
              >
                <span className="sm:hidden">{col.short}</span>
                <span className="hidden sm:inline">{col.label}</span>
              </p>
            ))}
          </div>
          <div className="mt-1 space-y-3">
            {guesses.map((g, rowIndex) => (
              <div key={`${g.personId ?? g.name}-${rowIndex}`}>
                <p className="mb-1 truncate text-xs font-medium text-paper">
                  {g.name}
                </p>
                <div className="grid grid-cols-6 gap-0.5 sm:gap-1.5">
                  {g.feedback.map((f, colIndex) => (
                    <Tile
                      key={f.key}
                      feedback={f}
                      column={colIndex}
                      animate={rowIndex === animateRow}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {gameOver && !modeLocked ? (
          <div className="mt-8 border-t border-paper/15 pt-6 text-center">
            <h2 className="font-display text-2xl text-paper">
              {solved
                ? `Got it in ${guesses.length} of ${maxAttempts}.`
                : "Out of guesses."}
            </h2>
            {!solved && answer ? (
              <p className="mt-2 text-paper/80">
                The player was{" "}
                <span className="font-semibold text-paper">{answer}</span>.
              </p>
            ) : null}
            {!solved ? (
              <p className="mt-1 text-sm text-paper/60">
                A new player arrives at midnight GST.
              </p>
            ) : null}

            <button
              type="button"
              onClick={playNextBoard}
              className="mt-6 rounded-full bg-signal px-8 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
            >
              Play the next board
            </button>

            {share ? (
              <button
                type="button"
                onClick={copyShare}
                className="mt-4 block w-full rounded-full border border-paper/30 px-7 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60 sm:mx-auto sm:w-auto"
              >
                {copied ? "Copied" : "Share your grid"}
              </button>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/reflections"
                className="rounded-full border border-paper/30 px-6 py-2.5 text-xs font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60"
              >
                Vote in The Reflections
              </Link>
              <Link
                href="/films"
                className="rounded-full border border-paper/30 px-6 py-2.5 text-xs font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60"
              >
                Watch the films
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {!gameOver && !modeLocked ? (
        <div className="mt-10">
          <h3 className="font-display text-xl text-navy">More daily modes</h3>
          <p className="mt-1 text-sm text-navy/60">
            Free members unlock six more boards, each with its own streak.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {lockedModes.map((m) => (
              <Link
                key={m.slug}
                href={`/guesser?mode=${m.slug}`}
                className="rounded-full border border-navy/20 px-4 py-1.5 text-sm text-navy/50 transition-colors hover:border-navy/40 hover:text-navy/70"
              >
                {m.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {signupOpen ? (
        <GuesserSignupPopup
          onClose={() => setSignupOpen(false)}
          signInHref={`/signin?next=${encodeURIComponent(signInNext)}`}
        />
      ) : null}
    </div>
  );
}
