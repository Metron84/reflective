"use client";

import styles from "./LandingBeacon.module.css";

const CX = 140;
const CY = 140;
const R_INNER = 24;
const R_OUTER = 58;
const SPOKES = 12;

/**
 * Distant 12-ray crest. Same center the starfield flies toward.
 * Empty geometry. The TRF mark is only the core of the light.
 */
export default function LandingBeacon() {
  const rays = Array.from({ length: SPOKES }, (_, i) => {
    const ang = (Math.PI * 2 * i) / SPOKES - Math.PI / 2;
    const x1 = CX + Math.cos(ang) * R_INNER;
    const y1 = CY + Math.sin(ang) * R_INNER;
    const x2 = CX + Math.cos(ang) * R_OUTER;
    const y2 = CY + Math.sin(ang) * R_OUTER;
    return { x1, y1, x2, y2 };
  });

  return (
    <div className={styles.beacon} aria-hidden="true">
      <div className={styles.halo} />
      <svg
        className={styles.svg}
        viewBox="0 0 280 280"
        role="presentation"
      >
        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER + 10}
          fill="none"
          stroke="rgb(242 237 228 / 0.22)"
          strokeWidth="0.8"
        />
        <circle
          cx={CX}
          cy={CY}
          r={(R_INNER + R_OUTER) / 2}
          fill="none"
          stroke="rgb(242 237 228 / 0.14)"
          strokeWidth="0.6"
        />
        {rays.map((r, i) => (
          <line
            key={i}
            x1={r.x1}
            y1={r.y1}
            x2={r.x2}
            y2={r.y2}
            stroke="rgb(242 237 228 / 0.55)"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        ))}
      </svg>
      <img
        src="/crest/icons/icon-192.png"
        alt=""
        className={styles.core}
        width={56}
        height={56}
      />
    </div>
  );
}
