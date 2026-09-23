import styles from "./ultima.module.css";

export default function UltimaStatusBar({ label, value, ratio, tone }) {
  const n = Number(ratio);
  const fill = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

  return (
    <div className={styles.opStatus}>
      <div className={styles.opStatusHead}>
        {label ? <p className={styles.opStatusLabel}>{label}</p> : <span />}
        {value != null && value !== "" ? (
          <p className={styles.opStatusValue}>{value}</p>
        ) : null}
      </div>
      <div className={styles.opStatusTrack} aria-hidden>
        <div
          className={tone === "muted" ? styles.opStatusFillMuted : styles.opStatusFill}
          style={{ width: `${Math.round(fill * 100)}%` }}
        />
      </div>
    </div>
  );
}
