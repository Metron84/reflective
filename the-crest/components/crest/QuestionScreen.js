"use client";

import {
  PILLAR_Q,
  QUESTIONS,
  SCALE,
  flowAt,
} from "@the-crest/lib/quiz-content";
import Crest from "./Crest";
import ProgressRail from "./ProgressRail";
import BackButton from "./BackButton";
import styles from "./QuestionScreen.module.css";

/**
 * @param {{
 *   quizIndex: number;
 *   scores: (number|null)[];
 *   onAnswerDimension: (index: number, value: number) => void;
 *   onAnswerPillar: (w: { Heart: number; Mind: number; Soul: number }) => void;
 *   onBack: () => void;
 *   journey?: boolean;
 * }} props
 */
export default function QuestionScreen({
  quizIndex,
  scores,
  onAnswerDimension,
  onAnswerPillar,
  onBack,
  journey = false,
}) {
  const flow = flowAt(quizIndex);
  const isPillar = flow.type === "pillar";

  const questionText = isPillar ? PILLAR_Q.q : QUESTIONS[flow.d ?? 0].q;
  const options = isPillar
    ? PILLAR_Q.a.map((o) => ({ label: o.t, pillar: o.w }))
    : QUESTIONS[flow.d ?? 0].a.map((label, i) => ({
        label,
        value: SCALE[i],
      }));

  const selected = isPillar ? null : scores[flow.d ?? 0];
  const liveScores = scores.map((s) => (s == null ? 4 : s));

  return (
    <section
      className={`${styles.screen} ${journey ? styles.screenJourney : ""}`}
    >
      <ProgressRail quizIndex={quizIndex} total={12} journey={journey} />
      <div className={styles.crestLive} aria-hidden={false}>
        <Crest scores={liveScores} tone={journey ? "cream" : "navy"} />
      </div>
      <div className={styles.split}>
        <div className={styles.prompt}>
          <h2 className={styles.q}>{questionText}</h2>
        </div>
        <div className={styles.opts} role="group" aria-label={questionText}>
          {options.map((opt, i) => {
            const picked =
              !isPillar &&
              typeof opt.value === "number" &&
              selected === opt.value;
            return (
              <button
                key={i}
                type="button"
                className={`${styles.opt} ${picked ? styles.picked : ""}`}
                onClick={() => {
                  if (isPillar && opt.pillar) {
                    onAnswerPillar(opt.pillar);
                  } else if (typeof opt.value === "number") {
                    onAnswerDimension(flow.d ?? 0, opt.value);
                  }
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <BackButton onBack={onBack} journey={journey} />
    </section>
  );
}
