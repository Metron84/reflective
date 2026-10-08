import Link from "next/link";
import styles from "./play.module.css";

function SaveBlock({ finish, onRetry, retrying }) {
  if (finish.saved) {
    return (
      <div className={styles.notice} role="status">
        <p className={styles.prompt}>Score saved</p>
        <p className={styles.lede}>
          {finish.saved.counted
            ? "It counts for this week's leaderboard."
            : "Your first saved score each day counts for the leaderboard."}
        </p>
      </div>
    );
  }
  if (finish.signedIn === false) {
    return (
      <div>
        <a href={finish.signInHref} className={styles.primary}>
          Sign up free to save your score
        </a>
        <p className={styles.tagline}>Already a member? Sign in on the same page.</p>
      </div>
    );
  }
  return (
    <div className={styles.notice} role="alert">
      <p className={styles.prompt}>{finish.error ?? "Could not save your score."}</p>
      <button onClick={onRetry} disabled={retrying} className={styles.primary}>
        Try saving again
      </button>
    </div>
  );
}

export default function EndScreen({ base = "", finish, onAgain, onRetry, retrying }) {
  const s = finish.summary;
  const stats = [
    ["Questions answered", s.answered],
    ["Correct", s.correct],
    ["Incorrect", s.incorrect],
    ["Average points per question", s.averagePoints],
  ];
  return (
    <section className={styles.stack}>
      <p className={styles.kicker}>Full time</p>
      <p className={styles.scoreHero} data-testid="final-score">
        {s.score}
      </p>
      <p className={styles.lede}>points</p>
      <dl className={styles.statsList}>
        {stats.map(([k, v]) => (
          <div key={k} className={styles.statRow}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <SaveBlock finish={finish} onRetry={onRetry} retrying={retrying} />
      <button onClick={onAgain} className={styles.primary}>
        Play again
      </button>
      {/* Plain anchor: a client link to the same route would keep the end screen mounted. */}
      <a href="/play" className={styles.secondary}>
        See the leaderboard
      </a>
      <Link href={`${base}/films`} className={styles.secondary}>
        Watch films on TRF
      </Link>
    </section>
  );
}
