import ReflectionsBallot from "./ReflectionsBallot";
import styles from "./ArchiveSection.module.css";

/** Past activity, collapsed by default. */
export default function ArchiveSection({ ballot }) {
  return (
    <section className={styles.section} aria-labelledby="archive-title">
      <h2 id="archive-title" className={styles.title}>
        Archive
      </h2>
      <details className={styles.row}>
        <summary className={styles.summary}>
          <span>Your Reflectives 2026 ballot</span>
          <span className={styles.count}>
            {ballot.votedCount} of {ballot.total} voted
          </span>
        </summary>
        <ReflectionsBallot ballot={ballot} />
      </details>
    </section>
  );
}
