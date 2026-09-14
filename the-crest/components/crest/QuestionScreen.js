"use client";

import {
  CHARACTER_QUESTIONS,
  COLOR_Q,
  KIT_FAMILIES,
  PILLAR_Q,
  QUESTIONS,
  QUIZ_STEP_COUNT,
  SCALE,
  flowAt,
  sectionAt,
} from "@the-crest/lib/quiz-content";
import { SENSES_INTRO, SENSES_QUESTIONS } from "@the-crest/lib/senses";
import ProgressRail from "./ProgressRail";
import BackButton from "./BackButton";
import styles from "./QuestionScreen.module.css";

/**
 * @param {{
 *   quizIndex: number;
 *   scores: (number|null)[];
 *   character: { integrity: number|null; decency: number|null; respect: number|null; power: number|null };
 *   hatedColors?: string[];
 *   sensesAnswers?: (number|null)[];
 *   onAnswerDimension: (index: number, value: number) => void;
 *   onAnswerSense: (index: number, value: number) => void;
 *   onAnswerCharacter: (key: string, value: number) => void;
 *   onAnswerPillar: (w: { Heart: number; Mind: number; Soul: number }) => void;
 *   onAnswerColor: (color: string) => void;
 *   onBack: () => void;
 *   journey?: boolean;
 * }} props
 */
export default function QuestionScreen({
  quizIndex,
  scores,
  character,
  hatedColors = [],
  sensesAnswers = [],
  onAnswerDimension,
  onAnswerSense,
  onAnswerCharacter,
  onAnswerPillar,
  onAnswerColor,
  onBack,
  journey = false,
}) {
  const flow = flowAt(quizIndex);
  const isColor = flow.type === "color";
  const isPillar = flow.type === "pillar";
  const isCharacter = flow.type === "character";
  const isSense = flow.type === "sense";
  const charIndex = isCharacter ? flow.i ?? 0 : 0;
  const senseIndex = isSense ? flow.i ?? 0 : 0;

  const questionText = isColor
    ? COLOR_Q.q
    : isPillar
      ? PILLAR_Q.q
      : isCharacter
        ? CHARACTER_QUESTIONS[charIndex].q
        : isSense
          ? SENSES_QUESTIONS[senseIndex].q
          : QUESTIONS[flow.d ?? 0].q;

  const options = isColor
    ? []
    : isPillar
      ? PILLAR_Q.a.map((o) => ({ label: o.t, pillar: o.w }))
      : isCharacter
        ? CHARACTER_QUESTIONS[charIndex].a.map((label, i) => ({
            label,
            value: SCALE[i],
            charKey: CHARACTER_QUESTIONS[charIndex].key,
          }))
        : isSense
          ? SENSES_QUESTIONS[senseIndex].a.map((label, i) => ({
              label,
              value: SCALE[i],
            }))
          : QUESTIONS[flow.d ?? 0].a.map((label, i) => ({
              label,
              value: SCALE[i],
            }));

  const selected = isColor
    ? hatedColors
    : isPillar
      ? null
      : isCharacter
        ? character[CHARACTER_QUESTIONS[charIndex].key]
        : isSense
          ? sensesAnswers[senseIndex]
          : scores[flow.d ?? 0];

  const showSensesIntro = isSense && senseIndex === 0;
  const senseLabel = isSense ? SENSES_QUESTIONS[senseIndex].label : null;
  const threeOptions = !isColor && options.length === 3;

  return (
    <section
      className={`${styles.screen} ${journey ? styles.screenJourney : ""}`}
    >
      <ProgressRail
        section={sectionAt(quizIndex)}
        quizIndex={quizIndex}
        total={QUIZ_STEP_COUNT}
        journey={journey}
      />
      <div className={styles.split}>
        <div className={styles.prompt}>
          {showSensesIntro ? (
            <p className={styles.lead}>{SENSES_INTRO}</p>
          ) : null}
          {senseLabel ? <p className={styles.theme}>{senseLabel}</p> : null}
          <h2 className={styles.q}>{questionText}</h2>
          {isColor ? <p className={styles.lead}>{COLOR_Q.lead}</p> : null}
        </div>
        {isColor ? (
          <div className={styles.colorGrid} role="group" aria-label={questionText}>
            {KIT_FAMILIES.map((color) => {
              const rank = Array.isArray(selected)
                ? selected.indexOf(color) + 1
                : 0;
              const picked = rank > 0;
              return (
                <button
                  key={color}
                  type="button"
                  className={`${styles.colorChip} ${picked ? styles.colorPicked : ""}`}
                  aria-pressed={picked}
                  aria-label={picked ? `${color}, rank ${rank}` : color}
                  onClick={() => onAnswerColor(color)}
                >
                  <span
                    className={`${styles.swatch} ${styles[`swatch_${color}`]}`}
                    aria-hidden="true"
                  />
                  <span className={styles.colorName}>{color}</span>
                  {picked ? (
                    <span className={styles.colorRank} aria-hidden="true">
                      {rank}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div
            className={`${styles.opts} ${threeOptions ? styles.optsThree : ""}`}
            role="group"
            aria-label={questionText}
          >
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
                    } else if (
                      isCharacter &&
                      opt.charKey &&
                      typeof opt.value === "number"
                    ) {
                      onAnswerCharacter(opt.charKey, opt.value);
                    } else if (isSense && typeof opt.value === "number") {
                      onAnswerSense(senseIndex, opt.value);
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
        )}
      </div>
      <BackButton onBack={onBack} journey={journey} />
    </section>
  );
}
