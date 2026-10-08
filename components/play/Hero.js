import styles from "./feedback.module.css";

/** Landing headline with a short floodlight sweep. Static when the player prefers reduced motion. */
export default function Hero() {
  return (
    <div className={styles.hero}>
      <p className={styles.kicker}>The Reflective Football</p>
      <h1 className={styles.headline}>Are You Really a Fan?</h1>
      <span className={styles.beam} aria-hidden="true" />
    </div>
  );
}
