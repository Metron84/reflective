import Link from "next/link";
import styles from "./TrainingRibbon.module.css";

export default function TrainingRibbon() {
  return (
    <section className={styles.ribbon} aria-labelledby="training-ribbon-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Now teaching</p>
          <h2 id="training-ribbon-title" className={styles.title}>
            Learn media. Practice media. One month, four seats.
          </h2>
          <p className={styles.lede}>
            A hands-on media course in Dubai, taught by Melo Doumani. AED 2,500
            for the founding cohort. Rolling intake.
          </p>
        </div>
        <Link href="/training" className={styles.cta}>
          See the course
        </Link>
      </div>
    </section>
  );
}
