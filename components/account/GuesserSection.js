import Link from "next/link";
import ShareStatsButton from "./ShareStatsButton";
import styles from "./GuesserSection.module.css";

const TODAY_LABEL = {
  not_played: "Not played",
  won: "Won",
  lost: "Lost",
};

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

function TodayChip({ status }) {
  const key = status ?? "not_played";
  return (
    <p className={`${styles.todayChip} ${styles[`today_${key}`]}`}>
      {TODAY_LABEL[key] ?? TODAY_LABEL.not_played}
    </p>
  );
}

function ModeCard({ mode }) {
  const doneToday =
    mode.todayStatus === "won" || mode.todayStatus === "lost";
  const cta = !mode.hasPlayed
    ? "Play your first"
    : doneToday
      ? "Done for today"
      : "Play today";

  if (!mode.hasPlayed) {
    return (
      <div className={`${styles.card} ${styles.cardQuiet}`}>
        <div className={styles.cardTop}>
          <h3 className={styles.modeName}>{mode.name}</h3>
          <TodayChip status={mode.todayStatus} />
        </div>
        <p className={styles.quietCopy}>No boards yet.</p>
        <Link
          href={`/guesser?mode=${mode.slug}`}
          className={styles.playLink}
        >
          {cta}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <h3 className={styles.modeName}>{mode.name}</h3>
        <TodayChip status={mode.todayStatus} />
      </div>
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
        {cta}
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
