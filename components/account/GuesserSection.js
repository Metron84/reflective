import Link from "next/link";
import ShareStatsButton from "./ShareStatsButton";
import styles from "./GuesserSection.module.css";

function DistributionBar({ distribution }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (!total) return null;

  return (
    <div className={styles.distribution}>
      <p className={styles.distributionLabel}>Guess distribution</p>
      <div className={styles.distributionBars}>
        {[1, 2, 3, 4, 5, 6].map((n) => {
          const count = distribution[n] ?? 0;
          const pct = total ? (count / total) * 100 : 0;
          return (
            <div key={n} className={styles.distCol}>
              <div className={styles.distTrack}>
                <div className={styles.distFill} style={{ height: `${pct}%` }} />
              </div>
              <span className={styles.distNum}>{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModeCard({ mode }) {
  if (!mode.hasPlayed) {
    return (
      <div className={`${styles.card} ${styles.cardQuiet}`}>
        <h3 className={styles.modeName}>{mode.name}</h3>
        <p className={styles.quietCopy}>No boards yet.</p>
        <Link
          href={`/guesser?mode=${mode.slug}`}
          className={styles.playLink}
        >
          Play your first
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h3 className={styles.modeName}>{mode.name}</h3>
      <p className={styles.streak}>{mode.currentStreak}</p>
      <p className={styles.streakLabel}>Current streak</p>
      <dl className={styles.statsGrid}>
        <div>
          <dt>Best streak</dt>
          <dd>{mode.bestStreak}</dd>
        </div>
        <div>
          <dt>Played</dt>
          <dd>{mode.played}</dd>
        </div>
        <div>
          <dt>Won</dt>
          <dd>{mode.won}</dd>
        </div>
        <div>
          <dt>Avg clues</dt>
          <dd>{mode.avgClues != null ? mode.avgClues.toFixed(1) : "–"}</dd>
        </div>
      </dl>
      <DistributionBar distribution={mode.distribution} />
      <Link href={`/guesser?mode=${mode.slug}`} className={styles.playLink}>
        Play today
      </Link>
    </div>
  );
}

export default function GuesserSection({ modeStats, shareStats }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>The Guesser</h2>
        <ShareStatsButton shareText={shareStats} />
      </div>
      <div className={styles.grid}>
        {modeStats.map((mode) => (
          <ModeCard key={mode.slug} mode={mode} />
        ))}
      </div>
    </section>
  );
}
