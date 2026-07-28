"use client";

import { useCallback, useRef, useState } from "react";
import YouTubeFacade from "./YouTubeFacade";
import NomineeCard from "./NomineeCard";
import styles from "./CategoryBallotSection.module.css";

function categoryThumbSrc(category) {
  if (category.category_poster) return category.category_poster;
  if (category.category_youtube_id) {
    return `https://i.ytimg.com/vi/${category.category_youtube_id}/hqdefault.jpg`;
  }
  return null;
}

/**
 * Editorial Reflectives category ballot (Best Video pattern).
 * Reuses existing vote props; does not change voting behavior.
 * When category.cardVariant is flag/title/quote, renders NomineeCard
 * that seeks the section compilation reel via remount.
 */
export default function CategoryBallotSection({
  category,
  index,
  nominees,
  votingOpen,
  categoryVoted,
  picks,
  pendingVote,
  canVote,
  standings,
  errors,
  onVote,
  CategoryStandings,
  isSignedIn,
}) {
  const categoryPending = pendingVote?.category === category.slug;
  const count = nominees.length;
  const num = String(index + 1).padStart(2, "0");
  const thumb = categoryThumbSrc(category);
  const reelId = category.category_youtube_id;
  const cardVariant = category.cardVariant;
  const useNomineeCard =
    cardVariant === "flag" ||
    cardVariant === "title" ||
    cardVariant === "quote";

  const reelRef = useRef(null);
  const [reelStart, setReelStart] = useState(0);
  const [reelKey, setReelKey] = useState(0);
  const [reelAutoPlay, setReelAutoPlay] = useState(false);

  const onWatchMoment = useCallback((seconds) => {
    const start =
      Number.isFinite(Number(seconds)) && Number(seconds) > 0
        ? Math.floor(Number(seconds))
        : 0;
    setReelStart(start);
    setReelAutoPlay(true);
    setReelKey((k) => k + 1);
    // Nice-to-have on mobile: bring the section player into view.
    requestAnimationFrame(() => {
      reelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, []);

  return (
    <section
      id={category.slug}
      className={styles.section}
      aria-labelledby={`${category.slug}-heading`}
    >
      <header className={styles.header}>
        <h2 id={`${category.slug}-heading`} className={styles.title}>
          <span className={styles.num}>{num}</span> {category.name}
        </h2>
        <p className={styles.meta}>
          {count} nominees · vote for one
        </p>
      </header>

      {errors ? <p className={styles.error}>{errors}</p> : null}

      {reelId ? (
        <div className={styles.reel} ref={reelRef}>
          <YouTubeFacade
            key={`${reelId}-${reelKey}`}
            youtubeId={reelId}
            title={`${category.name} nominees`}
            posterSrc={thumb}
            startSeconds={reelStart}
            autoPlay={reelAutoPlay}
          />
        </div>
      ) : null}

      <ul className={styles.list}>
        {nominees.map((nominee) => {
          const isPick = picks[category.slug] === nominee.id;
          const dimmed = categoryVoted && !isPick;
          const pending =
            categoryPending && pendingVote?.nomineeId === nominee.id;
          const playId = nominee.youtube_id || reelId;

          if (useNomineeCard) {
            return (
              <li key={nominee.id}>
                <NomineeCard
                  nominee={nominee}
                  variant={cardVariant}
                  votingOpen={votingOpen}
                  categoryVoted={categoryVoted}
                  isPick={isPick}
                  pending={pending}
                  disabled={categoryPending}
                  canVote={canVote}
                  onVote={() => onVote(nominee.id)}
                  onWatchMoment={onWatchMoment}
                  showQuoteMarks={category.showQuoteMarks !== false}
                />
              </li>
            );
          }

          return (
            <li
              key={nominee.id}
              className={`${styles.card} ${isPick ? styles.cardPick : ""} ${
                dimmed ? styles.cardDimmed : ""
              }`}
            >
              <div className={styles.media}>
                <YouTubeFacade
                  youtubeId={playId}
                  title={nominee.title}
                  startSeconds={nominee.clip_start_seconds}
                  posterSrc={thumb}
                />
              </div>
              <div className={styles.body}>
                <h3 className={styles.cardTitle}>{nominee.title}</h3>
                {nominee.context_line ? (
                  <p className={styles.context}>{nominee.context_line}</p>
                ) : null}
                <div className={styles.actions}>
                  {isPick ? (
                    <span className={styles.yourPick}>Your pick</span>
                  ) : votingOpen && canVote ? (
                    <button
                      type="button"
                      disabled={categoryPending}
                      onClick={() => onVote(nominee.id)}
                      className={styles.voteBtn}
                    >
                      {pending ? "Counting your vote" : "Vote"}
                    </button>
                  ) : votingOpen && !canVote && !categoryVoted ? (
                    <a
                      href="/signin?next=/reflections"
                      className={styles.signInLink}
                    >
                      Sign up free to vote
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {categoryVoted ? (
        <CategoryStandings
          standings={standings}
          pickId={picks[category.slug]}
        />
      ) : !isSignedIn ? (
        <p className={styles.hint}>
          <a href="/signin?next=/reflections">Sign up free to vote</a>
          . The race for this category opens after your pick.
        </p>
      ) : (
        <p className={styles.hint}>Vote to open this category&apos;s race.</p>
      )}
    </section>
  );
}
