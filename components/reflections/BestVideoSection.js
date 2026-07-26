"use client";

import YouTubeFacade from "./YouTubeFacade";
import styles from "./BestVideoSection.module.css";

/**
 * Editorial Best Video layout (Section 1 redesign).
 * Reuses existing vote props; does not change voting behavior.
 */
export default function BestVideoSection({
  category,
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

  return (
    <section
      id={category.slug}
      className={styles.section}
      aria-labelledby={`${category.slug}-heading`}
    >
      <header className={styles.header}>
        <h2 id={`${category.slug}-heading`} className={styles.title}>
          <span className={styles.num}>01</span> Best Video
        </h2>
        <p className={styles.meta}>
          {count} nominees · vote for one
        </p>
      </header>

      {errors ? <p className={styles.error}>{errors}</p> : null}

      {category.category_youtube_id ? (
        <div className={styles.reel}>
          <YouTubeFacade
            youtubeId={category.category_youtube_id}
            title="Best Video nominees"
          />
        </div>
      ) : null}

      <ul className={styles.list}>
        {nominees.map((nominee) => {
          const isPick = picks[category.slug] === nominee.id;
          const dimmed = categoryVoted && !isPick;
          const pending =
            categoryPending && pendingVote?.nomineeId === nominee.id;

          return (
            <li
              key={nominee.id}
              className={`${styles.card} ${isPick ? styles.cardPick : ""} ${
                dimmed ? styles.cardDimmed : ""
              }`}
            >
              <div className={styles.media}>
                <YouTubeFacade
                  youtubeId={nominee.youtube_id}
                  title={nominee.title}
                  startSeconds={nominee.clip_start_seconds}
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
