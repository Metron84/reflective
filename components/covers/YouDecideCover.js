import styles from "./YouDecideCover.module.css";

export default function YouDecideCover() {
  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.cards}>
        <div className={`${styles.card} ${styles.cardA}`} />
        <div className={`${styles.card} ${styles.cardB}`} />
        <span className={styles.vs}>VS</span>
      </div>
    </div>
  );
}
