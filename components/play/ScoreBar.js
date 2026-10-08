import ScoreValue from "./ScoreValue.js";
import fb from "./feedback.module.css";
import { roundLabel, streakBadge } from "@/lib/play/feedback.js";
import styles from "./play.module.css";

export default function ScoreBar({ score, answered, max, streak = 0 }) {
  const badge = streakBadge(streak);
  return (
    <div className={styles.stats} role="status" aria-live="polite">
      <div className={styles.panel}>
        <p className={styles.panelLabel}>{roundLabel(answered, max)}</p>
        <div className={styles.panelRow}>
          <p className={styles.panelValue}>{Math.min(answered + 1, max)}</p>
          {badge && (
            <span key={badge} className={fb.streak} aria-label={`${streak} correct in a row`}>
              {badge}
            </span>
          )}
        </div>
        <p className={styles.panelHint}>of {max}</p>
      </div>
      <div className={styles.panel}>
        <p className={styles.panelLabel}>Points</p>
        <p className={styles.panelValue} data-testid="score">
          <ScoreValue score={score} />
        </p>
      </div>
    </div>
  );
}
