import Link from "next/link";
import { puzzleNumber } from "@/lib/guesser/config";

export default function GuesserBand() {
  const puzzle = puzzleNumber();

  return (
    <section className="hero-grain relative border-b border-navy/10 bg-navy-deep px-6 py-14 sm:py-20">
      <div className="relative z-10 mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_min(16rem,38%)] lg:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-paper/45">
            The Guesser
          </p>
          <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
            Five players a day. Clues on a timer. Buzz in before the points drain.
          </h2>
          <p className="mt-8 text-xs uppercase tracking-[0.25em] text-paper/50">
            Board #{puzzle}
          </p>
          <Link
            prefetch={false}
            href="/guesser"
            className="mt-6 inline-block rounded-full border border-paper/30 px-8 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60"
          >
            Play today&apos;s board
          </Link>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-sm border border-paper/10 bg-navy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/games/the-guesser-band.svg"
            alt="The Guesser: five players, twenty points. A player silhouette with a red question mark, four cylinders worth 4, 3, 2 and 1 points, and a red BUZZ button."
            width={1200}
            height={900}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </section>
  );
}
