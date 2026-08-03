"use client";

import Link from "next/link";

const DEFAULT_BULLETS = [
  "Unlock five more daily modes, each with its own streak",
  "Vote in The Reflectives",
  "Be first to new films, games, and news",
];

export default function GuesserSignupPopup({
  onClose,
  signInHref = "/signin?next=/guesser",
  title = "Play the next board",
  body = "Create your free Reflective Football account for five more boards today, and your streak saved for tomorrow.",
  bullets = DEFAULT_BULLETS,
  allowDismiss = true,
  titleId = "guesser-signup-title",
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="w-full max-w-md border border-navy/15 bg-paper p-8 shadow-2xl">
        <h2 id={titleId} className="font-display text-2xl text-navy">
          {title}
        </h2>
        <p className="mt-4 text-sm text-navy/80">{body}</p>
        {bullets?.length ? (
          <ul className="mt-3 space-y-2 text-sm text-navy/80">
            {bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={signInHref}
            className="flex-1 rounded-full bg-signal px-6 py-3 text-center text-sm font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            Sign up free
          </Link>
          {allowDismiss && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-navy/30 px-6 py-3 text-sm text-navy/80 transition-colors hover:border-navy/60 hover:text-navy"
            >
              Maybe later
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
