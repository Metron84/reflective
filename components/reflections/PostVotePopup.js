"use client";

import Link from "next/link";

// Copy is fixed by the spec (section 7). Do not edit without Melo.
export default function PostVotePopup({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-vote-title"
    >
      <div className="w-full max-w-md border border-navy/15 bg-paper p-8 shadow-2xl">
        <h2 id="post-vote-title" className="font-display text-2xl text-navy">
          Thanks for voting! Your pick is in.
        </h2>
        <p className="mt-4 text-sm text-navy/80">
          Create your free Reflective Football account to:
        </p>
        <ul className="mt-3 space-y-2 text-sm text-navy/80">
          <li>See live results for The Reflections</li>
          <li>Play The Guesser daily and keep your streak</li>
          <li>Be first to new films, games, and news</li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signin?next=/reflections"
            className="flex-1 rounded-full bg-signal px-6 py-3 text-center text-sm font-medium uppercase tracking-widest text-paper transition-opacity hover:opacity-90"
          >
            Sign up free
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-navy/30 px-6 py-3 text-sm text-navy/80 transition-colors hover:border-navy/60 hover:text-navy"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
