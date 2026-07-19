import styles from "./TypingIndicator.module.css";

export default function TypingIndicator() {
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.sr}>The Concierge is thinking</span>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}
