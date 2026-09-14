"use client";

import { HEART_END, MIND_END, SENSES_END, SOUL_END } from "@the-crest/lib/quiz-content";
import styles from "./ProgressRail.module.css";

const SEGMENTS = [
  { id: "heart", label: "Heart", doneAt: HEART_END },
  { id: "mind", label: "Mind", doneAt: MIND_END },
  { id: "senses", label: "Senses", doneAt: SENSES_END },
  { id: "soul", label: "Soul", doneAt: SOUL_END },
];

/**
 * @param {{
 *   quizIndex?: number;
 *   section?: string;
 *   total?: number;
 *   journey?: boolean;
 *   activeIndex?: number;
 * }} props
 */
export default function ProgressRail({
  quizIndex = 0,
  section = "heart",
  total = 12,
  journey = false,
  activeIndex,
}) {
  const index = activeIndex ?? quizIndex;

  if (!journey) {
    const step = Math.min(index + 1, total);
    const label =
      index >= total ? `${total} of ${total}` : `${step} of ${total}`;
    return (
      <div className={styles.wrap}>
        <p className={styles.label}>{label}</p>
        <div className={styles.rail} aria-hidden="true">
          {Array.from({ length: total }, (_, i) => {
            let className = styles.tick;
            if (i < index) className += ` ${styles.done}`;
            else if (i === index && index < total) className += ` ${styles.now}`;
            return <span key={i} className={className} />;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${styles.wrapJourney}`}>
      <p className={styles.label}>The journey</p>
      <svg
        className={styles.arc}
        viewBox="0 0 280 78"
        role="img"
        aria-label={`Heart, Mind, Senses, Soul. Now ${section}.`}
      >
        {SEGMENTS.map((seg, i) => {
          const start = 200 + i * 40;
          const end = start + 34;
          const done = index >= seg.doneAt;
          const now = section === seg.id && !done;
          return (
            <g key={seg.id}>
              <path
                d={arcPath(140, 70, 52, start, end)}
                fill="none"
                className={
                  done ? styles.arcDone : now ? styles.arcNow : styles.arcIdle
                }
                strokeWidth="3"
                strokeLinecap="round"
              />
              <text
                x={labelX(140, 70, 64, (start + end) / 2)}
                y={labelY(140, 70, 64, (start + end) / 2)}
                textAnchor="middle"
                className={styles.arcLabel}
              >
                {seg.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function labelX(cx, cy, r, deg) {
  return polar(cx, cy, r, deg).x;
}

function labelY(cx, cy, r, deg) {
  return polar(cx, cy, r, deg).y + 4;
}
