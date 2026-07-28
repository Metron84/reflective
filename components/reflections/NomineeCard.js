"use client";

import YouTubeFacade from "./YouTubeFacade";
import { getNationBands } from "@/lib/nationColors";
import styles from "./NomineeCard.module.css";

/**
 * @typedef {object} Nominee
 * @property {string} id
 * @property {string} category
 * @property {string} title
 * @property {string | null} [youtube_id]
 * @property {string | null} [context_line]
 * @property {number | null} [clip_start_seconds]
 * @property {string | null} [nation]
 * @property {number} [sort]
 */

/**
 * Show the nation eyebrow unless the title already contains that nation token
 * (or any dual-nation part). Case-insensitive.
 * @param {string | null | undefined} title
 * @param {string | null | undefined} nation
 */
function shouldShowNationEyebrow(title, nation) {
  if (!nation) return false;
  const hay = String(title || "").toLowerCase();
  if (!hay) return true;
  const tokens = nation
    .split(/\s*&\s*/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return !tokens.some((token) => hay.includes(token));
}

function FlagBar({ nation, compact = false }) {
  const segments = getNationBands(nation);
  return (
    <div
      className={compact ? styles.flagBarCompact : styles.flagBar}
      aria-hidden
    >
      {segments.map((segment, sIdx) => (
        <div
          key={`${segment.nation || "fallback"}-${sIdx}`}
          className={styles.flagSegment}
        >
          {segment.bands.map((hex, bIdx) => (
            <span
              key={`${hex}-${bIdx}`}
              className={styles.flagBand}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function VoteActions({
  isPick,
  votingOpen,
  canVote,
  categoryVoted,
  pending,
  disabled,
  onVote,
  signInClassName,
}) {
  if (isPick) {
    return <span className={styles.yourPick}>Your pick</span>;
  }
  if (votingOpen && canVote) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onVote}
        className={styles.voteBtn}
      >
        {pending ? "Counting your vote" : "Vote"}
      </button>
    );
  }
  if (votingOpen && !canVote && !categoryVoted) {
    return (
      <a
        href="/signin?next=/reflections"
        className={signInClassName || styles.signInLink}
      >
        Sign up free to vote
      </a>
    );
  }
  return null;
}

function WatchRow({ start, onWatchMoment, className }) {
  return (
    <button
      type="button"
      className={className || styles.watch}
      onClick={() => {
        if (typeof onWatchMoment === "function") {
          onWatchMoment(Number.isFinite(Number(start)) ? Number(start) : 0);
        }
      }}
    >
      <svg
        className={styles.watchIcon}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      Watch the moment
    </button>
  );
}

function FlagOrTitleCard({
  nominee,
  variant,
  votingOpen,
  categoryVoted,
  isPick,
  pending,
  disabled,
  onVote,
  canVote,
  onWatchMoment,
  dimmed,
}) {
  const showNation =
    variant === "flag" &&
    shouldShowNationEyebrow(nominee.title, nominee.nation);
  const titleClass =
    variant === "title" ? styles.titleHero : styles.title;

  return (
    <article
      className={`${styles.card} ${isPick ? styles.cardPick : ""} ${
        dimmed ? styles.cardDimmed : ""
      }`}
    >
      <FlagBar nation={nominee.nation} />
      <div className={styles.body}>
        {showNation ? <p className={styles.nation}>{nominee.nation}</p> : null}
        <h3 className={titleClass}>{nominee.title}</h3>
        {nominee.context_line ? (
          <p className={styles.context}>{nominee.context_line}</p>
        ) : null}
        <WatchRow
          start={nominee.clip_start_seconds}
          onWatchMoment={onWatchMoment}
        />
        <div className={styles.actions}>
          <VoteActions
            isPick={isPick}
            votingOpen={votingOpen}
            canVote={canVote}
            categoryVoted={categoryVoted}
            pending={pending}
            disabled={disabled}
            onVote={onVote}
          />
        </div>
      </div>
    </article>
  );
}

function QuoteCard({
  nominee,
  votingOpen,
  categoryVoted,
  isPick,
  pending,
  disabled,
  onVote,
  canVote,
  onWatchMoment,
  dimmed,
  showQuoteMarks = true,
}) {
  const quote = nominee.context_line || "";
  const hero = showQuoteMarks ? `\u201C${quote}\u201D` : quote;

  return (
    <article
      className={`${styles.quoteCard} ${isPick ? styles.cardPick : ""} ${
        dimmed ? styles.cardDimmed : ""
      }`}
    >
      <div className={styles.quoteBody}>
        {quote ? <p className={styles.quoteText}>{hero}</p> : null}
        <div className={styles.speakerRow}>
          {nominee.nation ? <FlagBar nation={nominee.nation} compact /> : null}
          <div className={styles.speakerMeta}>
            <h3 className={styles.speakerName}>{nominee.title}</h3>
            {nominee.nation ? (
              <p className={styles.speakerNation}>{nominee.nation}</p>
            ) : null}
          </div>
        </div>
        <WatchRow
          start={nominee.clip_start_seconds}
          onWatchMoment={onWatchMoment}
          className={styles.watchOnCream}
        />
        <div className={styles.actions}>
          <VoteActions
            isPick={isPick}
            votingOpen={votingOpen}
            canVote={canVote}
            categoryVoted={categoryVoted}
            pending={pending}
            disabled={disabled}
            onVote={onVote}
            signInClassName={styles.legacySignIn}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * Shared Reflectives nominee card.
 * Variants: flag (nation-led navy), title (film title + dual bar),
 * quote (cream quote hero). Unknown variants fall back to the old cream + facade.
 */
export default function NomineeCard({
  nominee,
  variant = "flag",
  votingOpen,
  categoryVoted,
  isPick,
  pending,
  disabled,
  onVote,
  canVote,
  onWatchMoment,
  youtubeId,
  posterSrc,
  showQuoteMarks = true,
}) {
  const dimmed = categoryVoted && !isPick;

  if (variant === "flag" || variant === "title") {
    return (
      <FlagOrTitleCard
        nominee={nominee}
        variant={variant}
        votingOpen={votingOpen}
        categoryVoted={categoryVoted}
        isPick={isPick}
        pending={pending}
        disabled={disabled}
        onVote={onVote}
        canVote={canVote}
        onWatchMoment={onWatchMoment}
        dimmed={dimmed}
      />
    );
  }

  if (variant === "quote") {
    return (
      <QuoteCard
        nominee={nominee}
        votingOpen={votingOpen}
        categoryVoted={categoryVoted}
        isPick={isPick}
        pending={pending}
        disabled={disabled}
        onVote={onVote}
        canVote={canVote}
        onWatchMoment={onWatchMoment}
        dimmed={dimmed}
        showQuoteMarks={showQuoteMarks}
      />
    );
  }

  return (
    <article
      className={`${styles.legacyCard} ${isPick ? styles.cardPick : ""} ${
        dimmed ? styles.cardDimmed : ""
      }`}
    >
      <div className={styles.legacyMedia}>
        <YouTubeFacade
          youtubeId={youtubeId || nominee.youtube_id}
          title={nominee.title}
          startSeconds={nominee.clip_start_seconds}
          posterSrc={posterSrc}
        />
      </div>
      <div className={styles.legacyBody}>
        <h3 className={styles.legacyTitle}>{nominee.title}</h3>
        {nominee.context_line ? (
          <p className={styles.legacyContext}>{nominee.context_line}</p>
        ) : null}
        <div className={styles.actions}>
          <VoteActions
            isPick={isPick}
            votingOpen={votingOpen}
            canVote={canVote}
            categoryVoted={categoryVoted}
            pending={pending}
            disabled={disabled}
            onVote={onVote}
            signInClassName={styles.legacySignIn}
          />
        </div>
      </div>
    </article>
  );
}
