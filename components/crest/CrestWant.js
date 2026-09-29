"use client";

import { STAKES } from "@/lib/crest/stakes";
import home from "./CrestHome.module.css";
import styles from "./CrestWant.module.css";

/**
 * One tap. That tap is the prior for every card that follows.
 *
 * @param {{
 *   onPick: (stakeId: import("@/lib/crest/stakes").CrestStakeId) => void,
 *   onBack: () => void,
 * }} props
 */
export default function CrestWant({ onPick, onBack }) {
  return (
    <div className={home.home}>
      <Road />
      <header className={home.topbar}>
        <button type="button" className={`${home.back} ${styles.back}`} onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </button>
        <span className={home.brand}>The Crest</span>
        <span />
      </header>

      <div className={styles.layout}>
        <div className={`${home.copy} ${styles.copy}`}>
          <h1 className={`${home.headline} ${styles.headline}`}>What do you want this club for?</h1>
          <p className={home.subline}>Pick one.</p>
        </div>

        <ul className={styles.list}>
          {STAKES.map((stake) => (
            <li key={stake.id}>
              <button type="button" className={styles.chip} onClick={() => onPick(stake.id)}>
                <span className={styles.label}>{stake.label}</span>
                <span className={styles.line}>{stake.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Road() {
  return (
    <svg className={home.road} viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="crest-want-horizon" cx="50%" cy="38%" r="40%">
          <stop offset="0" stopColor="#1B2742" stopOpacity="0.6" />
          <stop offset="1" stopColor="#1B2742" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="390" height="844" fill="url(#crest-want-horizon)" />
      <path d="M-20 844 L195 300" fill="none" stroke="#F2EDE4" strokeOpacity="0.06" strokeWidth="1" />
      <path d="M410 844 L195 300" fill="none" stroke="#F2EDE4" strokeOpacity="0.06" strokeWidth="1" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11 3.5 5.5 9 11 14.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
