"use client";

import { CLUE_OPENING_LABEL } from "@/lib/guesser/clues";

export default function ClueLadder({ opening, chips, onReveal, pendingClue }) {
  return (
    <div className="mb-6 space-y-4">
      {opening ? (
        <blockquote className="border-l-2 border-paper/20 pl-4">
          <p className="text-[10px] uppercase tracking-widest text-paper/40">
            {CLUE_OPENING_LABEL}
          </p>
          <p className="mt-2 font-display text-lg leading-snug text-paper/90 sm:text-xl">
            {opening}
          </p>
        </blockquote>
      ) : null}

      <p className="text-xs text-paper/55">
        Wrong guesses unlock clue chips. Tap one to read it.
      </p>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const label = chip.label ?? `Clue ${chip.num}`;
          if (chip.status === "locked") {
            return (
              <span
                key={chip.num}
                className="rounded-full border border-paper/10 px-3 py-1.5 text-xs uppercase tracking-widest text-paper/25"
              >
                {label}
              </span>
            );
          }
          if (chip.status === "revealed") {
            return (
              <div
                key={chip.num}
                className="w-full rounded border border-paper/15 bg-navy-deep/50 px-4 py-3"
              >
                <p className="text-[10px] uppercase tracking-widest text-paper/40">
                  {label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-paper/85">
                  {chip.text}
                </p>
              </div>
            );
          }
          return (
            <button
              key={chip.num}
              type="button"
              disabled={pendingClue === chip.num}
              onClick={() => onReveal(chip.num)}
              className="rounded-full border border-paper/30 px-3 py-1.5 text-xs uppercase tracking-widest text-paper/70 transition-colors hover:border-paper/60 hover:text-paper disabled:opacity-50"
            >
              {pendingClue === chip.num ? "Opening" : label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
