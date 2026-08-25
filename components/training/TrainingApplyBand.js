import styles from "./TrainingApplyBand.module.css";

export default function TrainingApplyBand({ tone = "red" }) {
  const bandClass =
    tone === "cream" ? `${styles.band} ${styles.cream}` : styles.band;

  return (
    <section className={bandClass} aria-label="Apply for a seat">
      <div className={styles.inner}>
        <p className={styles.line}>Four seats. One month. Apply now.</p>
        <a href="#apply" className={styles.cta}>
          Apply for a seat
        </a>
      </div>
    </section>
  );
}
