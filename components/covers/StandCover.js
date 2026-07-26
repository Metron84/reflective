import styles from "./StandCover.module.css";

export default function StandCover({ compact = false }) {
  return (
    <div className={compact ? styles.compact : styles.root} aria-hidden>
      <div className={styles.badge}>Club</div>
      <div className={styles.badge}>Nation</div>
      <div className={styles.badge}>Player</div>
      <p className={styles.mark}>The Stand</p>
    </div>
  );
}
