"use client";

import { useEffect } from "react";
import { confettiPieces } from "@/lib/play/feedback.js";
import styles from "./feedback.module.css";

const PIECES = confettiPieces();

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** One-shot answer feedback. Mount it keyed per answer; it removes nothing and ignores pointer input. */
export default function Feedback({ result }) {
  const good = !!result.correct;

  useEffect(() => {
    if (good || reducedMotion()) return;
    document.body.classList.add(styles.shake);
    const t = setTimeout(() => document.body.classList.remove(styles.shake), 400);
    return () => {
      clearTimeout(t);
      document.body.classList.remove(styles.shake);
    };
  }, [good]);

  const change = result.pointsChange ?? 0;
  return (
    <div aria-hidden="true">
      <div className={`${styles.flash} ${good ? styles.flashGood : styles.flashBad}`} />
      {good && (
        <div className={styles.confetti}>
          {PIECES.map((p) => (
            <span
              key={p.id}
              className={styles.piece}
              style={{ background: p.color, animationDelay: `${p.delay}ms`, "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg` }}
            />
          ))}
        </div>
      )}
      {change !== 0 && (
        <div className={`${styles.points} ${good ? styles.pointsUp : styles.pointsDown}`}>
          {change > 0 ? `+${change}` : change}
        </div>
      )}
    </div>
  );
}
