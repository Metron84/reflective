import styles from "./HonoursSection.module.css";

function formatEarnedDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dubai",
  });
}

export default function HonoursSection({ honours }) {
  const { earned, nextTease } = honours;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Honours</h2>
      {earned.length === 0 && !nextTease ? (
        <p className={styles.empty}>
          Play The Guesser and vote in The Reflections to start your honours
          board.
        </p>
      ) : null}

      {earned.length > 0 ? (
        <ul className={styles.earnedList}>
          {earned.map((badge) => (
            <li key={badge.slug} className={styles.badge}>
              <span className={styles.mark} aria-hidden="true" />
              <div>
                <p className={styles.badgeName}>{badge.name}</p>
                <p className={styles.badgeDesc}>{badge.description}</p>
                <p className={styles.badgeDate}>{formatEarnedDate(badge.earnedAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {nextTease ? (
        <div className={styles.tease}>
          <p className={styles.teaseLabel}>Next within reach</p>
          <p className={styles.teaseText}>{nextTease.progress.label}</p>
          <p className={styles.teaseProgress}>
            {nextTease.progress.current} of {nextTease.progress.target}
          </p>
        </div>
      ) : null}
    </section>
  );
}
