import Link from "next/link";

// NO DEAD ENDS: the completion moment ends the ballot with exactly
// three labeled paths. Persists for returning complete voters.
export default function CompletionState({ total }) {
  return (
    <section
      id="reflections-complete"
      className="scroll-mt-32 border-b border-navy/10 py-20 text-center"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-navy/40">
        The Reflections
      </p>
      <h2 className="mt-3 font-display text-4xl text-navy sm:text-5xl">
        All {total} votes in. Thank you.
      </h2>
      <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/signin?next=/reflections"
          className="rounded-full bg-signal px-7 py-3 text-sm font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
        >
          See live results. Sign up free
        </Link>
        <Link
          href="/guesser"
          className="rounded-full border border-navy/30 px-7 py-3 text-sm font-medium uppercase tracking-widest text-navy transition-colors hover:border-navy/60"
        >
          Play The Guesser
        </Link>
        <Link
          href="/films"
          className="rounded-full border border-navy/30 px-7 py-3 text-sm font-medium uppercase tracking-widest text-navy transition-colors hover:border-navy/60"
        >
          Watch the films
        </Link>
      </div>
    </section>
  );
}
