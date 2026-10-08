import styles from "./play.module.css";

export default function ScoreBar({ score, answered, max }) {
  return (
    <div className={styles.stats} role="status" aria-live="polite">
      <div className={styles.panel}>
        <p className={styles.panelLabel}>Round</p>
        <p className={styles.panelValue}>{Math.min(answered + 1, max)}</p>
        <p className={styles.panelHint}>of {max}</p>
      </div>
      <div className={styles.panel}>
        <p className={styles.panelLabel}>Points</p>
        <p className={styles.panelValue} data-testid="score">
          {score}
        </p>
      </div>
    </div>
  );
}
