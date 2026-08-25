"use client";

import { TrainingPageVideo } from "@/components/training/TrainingSyllabus";
import styles from "./TrainingHero.module.css";

export default function TrainingHero() {
  return (
    <section
      id="training-hero"
      className={styles.hero}
      aria-labelledby="training-hero-title"
    >
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Media Training · Dubai</p>
          <h1 id="training-hero-title" className={styles.title}>
            <span className={styles.titleLine}>Learn media.</span>
            <span className={styles.titleLine}>Practice media.</span>
            <span className={styles.titleLine}>One month, four seats.</span>
          </h1>

          <p className={styles.sub}>
            Taught in the field by Melo Doumani, founder of The Reflective
            Football.
          </p>

          <ul className={styles.chips} aria-label="Course details">
            <li className={styles.chip}>Dubai · Four seats per cohort</li>
            <li className={styles.chip}>Next cohort dates announced soon</li>
          </ul>

          <a href="#apply" className={styles.cta}>
            Apply for a seat
          </a>
        </div>

        <div className={styles.videoPanel}>
          <TrainingPageVideo
            src="/training/hero.mp4"
            label="Media training preview"
            videoClassName={styles.video}
            frameClassName={styles.videoFrame}
          />
        </div>
      </div>
    </section>
  );
}
