"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./TrainingOutcomes.module.css";

const OUTCOMES = [
  {
    label: "Credentials",
    before: "You arrive with interest, not a finished portfolio.",
    after: "You leave with proof of work and a reference you can send.",
  },
  {
    label: "Work",
    before: "You have ideas, but nothing published under your name.",
    after: "You leave with a reel you shot, cut, and published.",
  },
  {
    label: "Network",
    before: "You know the industry from the outside.",
    after: "You leave with contacts in the room and a cohort beside you.",
  },
];

function OutcomeRow({ outcome, reducedMotion }) {
  const rowRef = useRef(null);
  const [revealed, setRevealed] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return undefined;

    const row = rowRef.current;
    if (!row) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(row);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const afterClassName = revealed
    ? `${styles.after} ${styles.afterRevealed}`
    : styles.after;

  return (
    <article ref={rowRef} className={styles.row}>
      <p className={styles.label}>{outcome.label}</p>
      <p className={styles.before}>{outcome.before}</p>
      <div className={styles.ruleMobile} aria-hidden="true" />
      <div className={styles.ruleDesktop} aria-hidden="true" />
      <p className={afterClassName}>{outcome.after}</p>
    </article>
  );
}

export default function TrainingOutcomes() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  return (
    <section
      className={styles.section}
      aria-labelledby="training-outcomes-title"
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>What you leave with</p>
        <h2 id="training-outcomes-title" className={styles.heading}>
          You finish with proof, not a promise.
        </h2>

        <div className={styles.rows}>
          {OUTCOMES.map((outcome) => (
            <OutcomeRow
              key={outcome.label}
              outcome={outcome}
              reducedMotion={reducedMotion}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
