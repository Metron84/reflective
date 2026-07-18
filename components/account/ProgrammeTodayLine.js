import styles from "./ProgrammeTodayLine.module.css";

export default function ProgrammeTodayLine({ todayLine }) {
  if (!todayLine) return null;
  const [summary, next] = todayLine.split("\n");

  return (
    <div className={styles.wrap}>
      <p className={styles.summary}>{summary}</p>
      {next ? <p className={styles.next}>{next}</p> : null}
    </div>
  );
}
