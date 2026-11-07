"use client";

import {
  CREST_CX,
  CREST_CY,
  CREST_R_MAX,
  CREST_R_MIN,
  crestSpokeTips,
} from "@the-crest/lib/crest-path";
import styles from "./Crest.module.css";

/**
 * Hairline twelve-spoke crest. Red centre disc r=26. No filled polygon.
 * @param {{ scores: number[]; className?: string; animate?: boolean; tone?: 'navy' | 'cream' }} props
 */
export default function Crest({
  scores,
  className,
  animate = false,
  tone = "navy",
}) {
  const tips = crestSpokeTips(scores);
  const line = tone === "cream" ? "#F2EDE4" : "#0A111F";
  const guideOpacity = tone === "cream" ? 0.35 : 0.4;

  return (
    <div className={`${styles.wrap} ${className ?? ""}`.trim()}>
      <svg
        viewBox="0 0 280 280"
        role="img"
        aria-label="Your football identity crest"
        className={`${styles.svg} ${animate ? styles.animate : ""}`}
      >
        <circle
          cx={CREST_CX}
          cy={CREST_CY}
          r={CREST_R_MAX}
          fill="none"
          stroke={line}
          strokeOpacity={guideOpacity}
          strokeWidth={0.5}
        />
        <circle
          cx={CREST_CX}
          cy={CREST_CY}
          r={CREST_R_MIN}
          fill="none"
          stroke={line}
          strokeOpacity={guideOpacity}
          strokeWidth={0.5}
        />
        <circle
          cx={CREST_CX}
          cy={CREST_CY}
          r={CREST_R_MIN}
          fill="#D8232A"
        />
        {tips.map((p, i) => (
          <line
            key={i}
            x1={CREST_CX}
            y1={CREST_CY}
            x2={p[0]}
            y2={p[1]}
            stroke={line}
            strokeWidth={0.75}
            strokeLinecap="round"
            className={styles.spoke}
          />
        ))}
      </svg>
    </div>
  );
}
