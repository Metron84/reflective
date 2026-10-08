"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./feedback.module.css";

const DELAY = 450; // lets the flying points arrive first
const DURATION = 600;

/** Score number that counts to its new value and glows gold when it goes up. */
export default function ScoreValue({ score }) {
  const [shown, setShown] = useState(score);
  const [glow, setGlow] = useState(false);
  const from = useRef(score);

  useEffect(() => {
    const start = from.current;
    if (score === start) return;
    from.current = score;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || score === 0) {
      const id = requestAnimationFrame(() => setShown(score));
      return () => cancelAnimationFrame(id);
    }
    const up = score > start;
    const t0 = performance.now() + DELAY;
    let raf;
    const step = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / DURATION));
      setShown(Math.round(start + (score - start) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const on = setTimeout(() => setGlow(up), DELAY);
    const off = setTimeout(() => setGlow(false), DELAY + DURATION + 700);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(on);
      clearTimeout(off);
      setShown(score);
    };
  }, [score]);

  return <span className={`${styles.scoreValue} ${glow ? styles.scoreGlow : ""}`}>{shown}</span>;
}
