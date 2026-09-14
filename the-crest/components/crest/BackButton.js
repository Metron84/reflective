"use client";

import styles from "./BackButton.module.css";

/** @param {{ onBack: () => void; hidden?: boolean; journey?: boolean }} props */
export default function BackButton({ onBack, hidden, journey = false }) {
  if (hidden) return null;
  return (
    <button
      type="button"
      className={`${styles.back} ${journey ? styles.backJourney : ""}`}
      onClick={onBack}
    >
      Back
    </button>
  );
}
