import Link from "next/link";

// NO DEAD ENDS: completion ends with three labeled paths.
// Members only reach here after voting (account required).
export default function CompletionState({ total }) {
  return (
    <section
      id="reflections-complete"
      className="scroll-mt-32 border-b border-navy/10 py-20 text-center"
    >
      <p className="text-xs uppercase tracking-[0.3em] text-navy/40">
        The Reflectives
      </p>
      <h2 className="mt-3 font-display text-4xl text-navy sm:text-5xl">
        All {total} votes in. Thank you.
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-sm text-navy/70">
        Your races are open above. Scroll any category to see the live standings.
      </p>
      <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/account"
          className="rounded-full bg-signal px-7 py-3 text-sm font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
        >
          Your ballot
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
