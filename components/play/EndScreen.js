import ProgrammeCTA from "@/components/ProgrammeCTA";
import MuteToggle from "./MuteToggle.js";
import FansButton from "./FansButton.js";
import fans from "./fans.module.css";
import { FANS_LINE } from "@/lib/play/links.js";
import styles from "./play.module.css";

function SaveBlock({ finish, onRetry, retrying, base }) {
  if (finish.saved) {
    return (
      <>
        <p className={styles.lede} role="status">
          {finish.saved.counted
            ? "It counts for this week's leaderboard."
            : "Your first saved score each day counts for the leaderboard."}
        </p>
        <ProgrammeCTA signedIn accountOrigin={base} />
      </>
    );
  }
  if (finish.signedIn === false) {
    return <ProgrammeCTA signedIn={false} />;
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

export default function EndScreen({ finish, onAgain, onRetry, retrying, onLeaderboard, base = "" }) {
  const s = finish.summary;
  const stats = [
    ["Questions answered", s.answered],
    ["Correct", s.correct],
    ["Incorrect", s.incorrect],
    ...(s.skipped ? [["Skipped", s.skipped]] : []),
    ["Average points per question", s.averagePoints],
  ];
  return (
    <section className={styles.stack}>
      <div className={styles.muteDock}>
        <MuteToggle />
      </div>
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
      <SaveBlock finish={finish} onRetry={onRetry} retrying={retrying} base={base} />
      <button onClick={onAgain} className={styles.primary}>
        Play again
      </button>
      {/* A button, not a link: navigating to /play reloads the app and drops the finished game. */}
      <button type="button" onClick={onLeaderboard} className={styles.secondary}>
        See the leaderboard
      </button>
      <p className={fans.line}>{FANS_LINE}</p>
      <FansButton className={styles.fansSlot} />
    </section>
  );
}
