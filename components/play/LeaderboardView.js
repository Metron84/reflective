"use client";

import { useEffect, useRef } from "react";
import { markPlayer } from "@/lib/play/leaderboard.js";
import MuteToggle from "./MuteToggle.js";
import styles from "./leaderboard.module.css";

/** In-app leaderboard: the finished game stays in memory, so Back returns to the same results. */
export default function LeaderboardView({ weeks = [], summary, finish, onAgain, onBack }) {
  const youRef = useRef(null);
  useEffect(() => {
    youRef.current?.scrollIntoView?.({ block: "center" });
  }, []);

  const saved = !!finish?.saved;
  return (
    <section className={styles.wrap} aria-label="Leaderboard">
      <div className={styles.top}>
        <button type="button" onClick={onBack} className={styles.back}>
          Back to results
        </button>
        <MuteToggle />
      </div>
      <h1 className={styles.title}>This Week&apos;s Champions</h1>
      <div className={styles.score} role="status">
        <p className={styles.scoreLabel}>Your score</p>
        <p className={styles.scoreValue} data-testid="leaderboard-score">{summary.score}</p>
      </div>
      {!saved && finish?.signedIn === false && finish.signInHref && (
        <a href={finish.signInHref} className={styles.signup}>
          Sign up free to save your score
        </a>
      )}
      {weeks.map((w, wi) => {
        const rows = markPlayer(w.rows, wi === 0 ? summary : null);
        return (
          <div key={w.title}>
            <h2 className={styles.weekHead}>
              {w.title} <span className={styles.weekDates}>{w.label}</span>
            </h2>
            {rows.length ? (
              <ol className={styles.rows}>
                {rows.map((r) => (
                  <li
                    key={`${r.rank}-${r.display_name}-${r.isYou ? "you" : ""}`}
                    ref={r.isYou ? youRef : null}
                    className={`${styles.row} ${r.isYou ? styles.you : ""}`}
                    aria-current={r.isYou ? "true" : undefined}
                  >
                    <span className={styles.rank}>{r.rank}</span>
                    <span className={styles.name}>{r.isYou ? `You${r.pending && !saved ? " (not saved)" : ""}` : r.display_name}</span>
                    <span className={styles.meta}>{r.correct} correct</span>
                    <span className={styles.pts}>{r.score}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>{w.emptyHint}</p>
            )}
          </div>
        );
      })}
      <button type="button" onClick={onAgain} className={styles.again}>
        PLAY AGAIN
      </button>
    </section>
  );
}
