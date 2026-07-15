import styles from "./GuesserBoardCover.module.css";

const TILES = [
  "correct",
  "close",
  "wrong",
  "wrong",
  "correct",
  "close",
  "wrong",
  "correct",
  "close",
  "wrong",
  "wrong",
  "correct",
];

export default function GuesserBoardCover({ compact = false }) {
  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ""}`}
      aria-hidden="true"
    >
      <div className={styles.gridWrap}>
        <div className={styles.grid}>
          {TILES.map((state, i) => (
            <span key={i} className={`${styles.tile} ${styles[state]}`} />
          ))}
        </div>
        <div className={styles.silhouette}>
          <span className={styles.question}>?</span>
        </div>
      </div>
    </div>
  );
}
