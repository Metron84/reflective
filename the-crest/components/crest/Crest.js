"use client";

import { useEffect, useRef } from "react";
import styles from "./Crest.module.css";

/**
 * @param {{ scores: number[]; className?: string; animate?: boolean }} props
 */
export default function Crest({ scores, className, animate = false }) {
  const cx = 140;
  const cy = 140;
  const rMin = 26;
  const rMax = 118;
  const pathRef = useRef(null);

  const pts = scores.map((s, i) => {
    const ang = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const r = rMin + ((s - 1) / 6) * (rMax - rMin);
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  });

  const pathD =
    pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ") +
    " Z";

  useEffect(() => {
    if (!animate || !pathRef.current) return;
    const path = pathRef.current;
    const len = path.getTotalLength();
    path.style.setProperty("--crest-len", String(len));
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.classList.add(styles.draw);
    const t = requestAnimationFrame(() => {
      path.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(t);
  }, [animate, pathD]);

  const motion = animate ? styles.motion : "";

  return (
    <div className={`${styles.wrap} ${className ?? ""}`.trim()}>
      <svg
        viewBox="0 0 280 280"
        role="img"
        aria-label="Your football identity crest"
        className={styles.svg}
      >
        <circle
          cx={cx}
          cy={cy}
          r={rMax}
          fill="none"
          stroke="#DED3C2"
          className={motion ? styles.ring : undefined}
        />
        <circle
          cx={cx}
          cy={cy}
          r={(rMax + rMin) / 2}
          fill="none"
          stroke="#DED3C2"
          className={motion ? styles.ring : undefined}
        />
        {pts.map((p, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p[0]}
            y2={p[1]}
            stroke="#0A111F"
            strokeOpacity={0.18}
            strokeWidth={1}
            className={motion ? styles.spoke : undefined}
            style={motion ? { animationDelay: `${80 + i * 35}ms` } : undefined}
          />
        ))}
        <path
          ref={pathRef}
          d={pathD}
          fill="#0A111F"
          fillOpacity={animate ? 0 : 0.9}
          className={motion ? `${styles.shape} ${styles.shapeFill}` : undefined}
        />
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill="#D8232A"
          className={motion ? styles.core : undefined}
        />
      </svg>
    </div>
  );
}
