"use client";

import styles from "./ProgressRail.module.css";

/**
 * Twelve ticks only. No numbers, no percentage.
 * @param {{
 *   quizIndex?: number;
 *   total?: number;
 *   journey?: boolean;
 * }} props
 */
export default function ProgressRail({
  quizIndex = 0,
  total = 12,
  journey = false,
}) {
  const ticks = Math.min(12, total);
  return (
    <div className={`${styles.wrap} ${journey ? styles.wrapJourney : ""}`}>
      <div
        className={styles.rail}
        aria-hidden="true"
        role="presentation"
      >
        {Array.from({ length: ticks }, (_, i) => {
          let className = styles.tick;
          if (i < quizIndex) className += ` ${styles.done}`;
          else if (i === quizIndex && quizIndex < ticks) {
            className += ` ${styles.now}`;
          }
          return <span key={i} className={className} />;
        })}
      </div>
    </div>
  );
}
