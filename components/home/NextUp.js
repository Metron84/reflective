import Link from "next/link";

/** Thin navy strip. Renders only when NEXT_UP is set in lib/home.js. */
export default function NextUp({ item }) {
  if (!item) return null;

  return (
    <div className="bg-navy text-paper">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 sm:px-6">
        <p className="text-sm">
          <span className="font-semibold uppercase tracking-widest">{item.label}</span>
          <span className="ml-3 text-paper/80">{item.date}</span>
        </p>
        <Link
          href={item.href}
          className="inline-flex min-h-[2rem] items-center gap-2 text-sm font-semibold uppercase tracking-widest transition-colors hover:text-paper/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
        >
          Details <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
