"use client";

import { useState } from "react";
import { abbreviateClub } from "@/lib/guesser/club-display";
import { explainClubChip } from "@/lib/guesser/tile-explain";

export const CHIP_STYLES = {
  correct: "bg-emerald-600 text-white",
  close: "bg-amber-400 text-navy",
  wrong: "bg-navy-deep text-paper/60 border border-paper/10",
  na: "bg-navy-deep text-paper/40 border border-paper/10",
};

function ClubChip({ chip, compact }) {
  const [tipOpen, setTipOpen] = useState(false);
  const label = abbreviateClub(chip.name);
  const explanation = explainClubChip(chip.name, chip.status);

  return (
    <div className="relative min-w-0 max-w-full">
      <button
        type="button"
        onClick={() => setTipOpen((v) => !v)}
        onMouseEnter={() => setTipOpen(true)}
        onMouseLeave={() => setTipOpen(false)}
        aria-expanded={tipOpen}
        aria-label={explanation}
        className={`inline-block max-w-full truncate rounded-sm px-0.5 py-px font-semibold leading-tight ${
          CHIP_STYLES[chip.status]
        } ${compact ? "text-[7px] sm:text-[8px]" : "text-[7px] sm:text-[9px]"}`}
      >
        {label}
      </button>
      {tipOpen ? (
        <p className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 w-max max-w-[min(14rem,calc(100vw-2rem))] -translate-x-1/2 rounded border border-paper/20 bg-navy-deep px-2 py-1.5 text-[10px] leading-snug text-paper/90 shadow-lg sm:text-xs">
          {explanation}
        </p>
      ) : null}
    </div>
  );
}

export default function ClubTile({ feedback, animate, column, compact = false }) {
  const clubs = feedback.clubs ?? [];

  if (!clubs.length) {
    return (
      <div
        className={`flex aspect-[4/5] min-h-[48px] w-full min-w-0 items-center justify-center rounded-sm border border-paper/10 bg-navy-deep px-0.5 py-1 text-center text-paper/40 sm:min-h-[56px] sm:rounded ${
          animate ? "tile-flip" : ""
        }`}
        style={animate ? { animationDelay: `${column * 200}ms` } : undefined}
      >
        <span className="text-[9px] font-semibold sm:text-xs">{"\u2013"}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex aspect-[4/5] min-h-[48px] w-full min-w-0 flex-col justify-center rounded-sm border border-paper/10 bg-navy-deep px-0.5 py-0.5 sm:min-h-[56px] sm:rounded ${
        animate ? "tile-flip" : ""
      }`}
      style={animate ? { animationDelay: `${column * 200}ms` } : undefined}
    >
      <div className="flex min-h-0 flex-wrap content-center justify-center gap-0.5">
        {clubs.map((chip) => (
          <ClubChip key={chip.name} chip={chip} compact={compact} />
        ))}
      </div>
    </div>
  );
}

export function HowToClubChips({ chips, compact = false }) {
  return (
    <div className="flex min-h-[2rem] flex-wrap content-center justify-center gap-0.5 rounded border border-paper/10 bg-navy-deep px-0.5 py-0.5">
      {chips.map((chip) => (
        <ClubChip key={chip.name} chip={chip} compact={compact} />
      ))}
    </div>
  );
}
