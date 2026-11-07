"use client";

import LandingBeacon from "./LandingBeacon";
import Reveal from "./Reveal";
import styles from "./OpeningScreen.module.css";

/** @param {{ onStart: () => void }} props */
export default function OpeningScreen({ onStart }) {
  return (
    <section className={styles.screen}>
      <div className={styles.stack}>
        <Reveal delay={0}>
          <LandingBeacon />
        </Reveal>
        <Reveal delay={120} className={styles.copy}>
          <h1 className={styles.mark}>
            The <em>Crest</em>
          </h1>
          <p className={styles.line}>
            Find the club that sounds like your heart, thinks like your mind and
            feels like your soul.
          </p>
          <button type="button" className={styles.start} onClick={onStart}>
            Begin
          </button>
        </Reveal>
      </div>
    </section>
  );
}
