import Link from "next/link";
import GuesserBoardCover from "@/components/covers/GuesserBoardCover";
import { CLUE_OPENING_LABEL } from "@/lib/guesser/clues";
import { puzzleNumber } from "@/lib/guesser/config";

export default function GuesserBand({ openingClue }) {
  const tease =
    openingClue ?? "SAMPLE: What they meant to the game, not what the stats say.";
  const puzzle = puzzleNumber();

  return (
    <section className="hero-grain relative border-b border-navy/10 bg-navy-deep px-6 py-14 sm:py-20">
      <div className="relative z-10 mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_min(16rem,38%)] lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-paper/45">
            The Guesser
          </p>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            One player a day. Six guesses.
          </h2>
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.25em] text-paper/50">
              Puzzle #{puzzle}
            </p>
            <div className="mt-4 border-t border-signal pt-5">
              <p className="text-[10px] uppercase tracking-widest text-paper/40">
                {CLUE_OPENING_LABEL}
              </p>
              <p className="mt-3 font-display text-lg leading-snug text-paper/90 sm:text-xl">
                {tease}
              </p>
            </div>
          </div>
          <Link
            href="/guesser"
            className="mt-8 inline-block rounded-full border border-paper/30 px-8 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60"
          >
            Play The Guesser
          </Link>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-sm border border-paper/10 lg:aspect-square">
          <GuesserBoardCover />
        </div>
      </div>
    </section>
  );
}
