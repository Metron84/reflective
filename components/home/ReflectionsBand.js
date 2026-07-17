import Link from "next/link";
import {
  REFLECTIONS_CATEGORIES,
  reflectionsCloseSummary,
  reflectionsDaysLeft,
  reflectionsWinnersDay,
} from "@/lib/config";

export default function ReflectionsBand({ votedCount, votingState }) {
  const total = REFLECTIONS_CATEGORIES.length;
  const open = votingState === "open";
  const daysLeft = reflectionsDaysLeft();

  return (
    <section className="hero-grain relative border-b border-navy/10 bg-navy px-6 py-14 sm:py-20">
      <div className="relative z-10 mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.35em] text-paper/45">
          The Reflections
        </p>
        <h2 className="mt-3 font-display text-3xl text-paper sm:text-4xl">
          Eight awards. Your vote decides.
        </h2>
        {open ? (
          <>
            <p className="mt-4 text-sm text-paper/60">
              {reflectionsCloseSummary()}. {daysLeft} days left.
            </p>
            {votedCount > 0 ? (
              <p className="mt-2 text-sm text-paper/75">
                You have voted in {votedCount} of {total} categories.
              </p>
            ) : (
              <p className="mt-2 text-sm text-paper/75">
                Pick your favourites across {total} categories.
              </p>
            )}
            <div className="mt-6 h-1 overflow-hidden rounded-full bg-paper/10">
              <div
                className="h-full bg-signal transition-all"
                style={{ width: `${(votedCount / total) * 100}%` }}
              />
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-paper/60">
            {votingState === "before"
              ? "Voting opens soon."
              : `Voting is closed. Winners revealed ${reflectionsWinnersDay()}.`}
          </p>
        )}
        {open ? (
          <Link
            href="/reflections"
            className="mt-8 inline-block rounded-full bg-signal px-8 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            {votedCount >= total ? "See your votes" : "Vote in The Reflections"}
          </Link>
        ) : (
          <Link
            href="/reflections"
            className="mt-8 inline-block rounded-full border border-paper/30 px-8 py-3 text-xs font-medium uppercase tracking-widest text-paper transition-colors hover:border-paper/60"
          >
            View The Reflections
          </Link>
        )}
      </div>
    </section>
  );
}
