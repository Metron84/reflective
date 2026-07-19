import styles from "./PageLoadingShell.module.css";

/**
 * Minimal route loading shell — static cream/navy blocks, no shimmer.
 * @param {{ variant?: "cream" | "navy" }} props
 */
export default function PageLoadingShell({ variant = "cream" }) {
  return (
    <div
      className={`${styles.shell} ${variant === "navy" ? styles.navy : styles.cream}`}
      aria-busy="true"
      aria-live="polite"
    >
      <div className={styles.inner}>
        <div className={styles.eyebrow} />
        <div className={styles.title} />
        <div className={styles.context} />
      </div>
      <span className={styles.sr}>Loading</span>
    </div>
  );
}
