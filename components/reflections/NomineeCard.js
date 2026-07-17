"use client";

import YouTubeFacade from "./YouTubeFacade";

// Footage-led block: nominee cards sit on navy, per the brand rules.
export default function NomineeCard({
  nominee,
  votingOpen,
  categoryVoted,
  isPick,
  pending,
  disabled,
  onVote,
  canVote,
}) {
  const dimmed = categoryVoted && !isPick;

  return (
    <article
      className={`flex flex-col overflow-hidden border bg-navy transition-opacity ${
        isPick ? "border-signal" : "border-navy/20"
      } ${dimmed ? "opacity-50" : ""}`}
    >
      <YouTubeFacade
        youtubeId={nominee.youtube_id}
        title={nominee.title}
        startSeconds={nominee.clip_start_seconds}
      />
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-xl text-paper">{nominee.title}</h3>
        {nominee.context_line ? (
          <p className="mt-2 text-sm leading-relaxed text-paper/70">
            {nominee.context_line}
          </p>
        ) : null}
        <div className="mt-auto pt-5">
          {isPick ? (
            <span className="inline-block rounded-full bg-signal px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-paper">
              Your pick
            </span>
          ) : votingOpen && canVote ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onVote}
              aria-live="polite"
              className={`rounded-full px-7 py-2.5 text-xs font-medium uppercase tracking-widest text-paper transition-all ${
                pending
                  ? "scale-95 bg-signal/70"
                  : "bg-signal hover:opacity-90 disabled:opacity-40"
              }`}
            >
              {pending ? "Counting your vote" : "Vote"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
