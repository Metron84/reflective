'use client';

import { useEffect, useMemo, useState } from 'react';
import PuzzleBoard from './PuzzleBoard';
import {
  buildAttribution,
  scoreFor,
  type Chapter,
  type Puzzle,
} from '@/lib/codemaster/engine';

const NAVY = '#0A111F';
const RED = '#D8232A';

interface Props {
  puzzle: Puzzle;
  chapter: Chapter;
  indexInChapter: number;
  chapterSize: number;
  allPuzzles: Puzzle[];
  alreadySolved: boolean;
  onComplete: (result: { score: number; hints: number; attribution: boolean }) => void;
  onNext: () => void;
  onBack: () => void;
  hasNext: boolean;
}

type Phase = 'grid' | 'attribution' | 'reveal';

export default function PlayView({
  puzzle,
  chapter,
  indexInChapter,
  chapterSize,
  allPuzzles,
  alreadySolved,
  onComplete,
  onNext,
  onBack,
  hasNext,
}: Props) {
  const questions = useMemo(() => buildAttribution(puzzle, allPuzzles), [puzzle, allPuzzles]);
  const [phase, setPhase] = useState<Phase>('grid');
  const [hints, setHints] = useState(0);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    setPhase('grid');
    setHints(0);
    setStep(0);
    setAnswers([]);
    setPicked(null);
  }, [puzzle.id]);

  const handleSolved = (hintsUsed: number) => {
    setHints(hintsUsed);
    setPhase(questions.length > 0 ? 'attribution' : 'reveal');
    if (questions.length === 0) {
      onComplete({ score: scoreFor(hintsUsed, false), hints: hintsUsed, attribution: false });
    }
  };

  const answer = (option: string) => {
    if (picked) return;
    const question = questions[step];
    const correct = option === question.answer;
    setPicked(option);
    const nextAnswers = [...answers, correct];
    window.setTimeout(() => {
      setAnswers(nextAnswers);
      setPicked(null);
      if (step + 1 < questions.length) {
        setStep(step + 1);
      } else {
        const allCorrect = nextAnswers.every(Boolean);
        setPhase('reveal');
        onComplete({ score: scoreFor(hints, allCorrect), hints, attribution: allCorrect });
      }
    }, 900);
  };

  const attribution = answers.length > 0 && answers.every(Boolean);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="font-[Archivo,system-ui,sans-serif] text-[13px] uppercase tracking-[0.12em]"
          style={{ color: 'rgba(10,17,31,0.6)' }}
        >
          ← {chapter.title}
        </button>
        <span
          className="font-[Archivo,system-ui,sans-serif] text-[13px] tabular-nums"
          style={{ color: 'rgba(10,17,31,0.6)' }}
        >
          {indexInChapter + 1} / {chapterSize}
        </span>
      </div>

      {alreadySolved && phase === 'grid' ? (
        <p
          className="mb-4 font-[Archivo,system-ui,sans-serif] text-[13px]"
          style={{ color: 'rgba(10,17,31,0.55)' }}
        >
          You have solved this one before. Solve it cleaner to raise your score.
        </p>
      ) : null}

      <div className="mb-5">
        <p
          className="font-[Archivo,system-ui,sans-serif] text-[12px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: RED }}
        >
          {puzzle.prompt ?? 'Decode the line'}
        </p>
        <p
          className="mt-1 font-[Archivo,system-ui,sans-serif] text-[13px] tabular-nums"
          style={{ color: 'rgba(10,17,31,0.55)' }}
        >
          {wordCount(puzzle.text)} {wordCount(puzzle.text) === 1 ? 'word' : 'words'},{' '}
          {puzzle.letters} letters. Every row reads left to right.
        </p>
      </div>

      <PuzzleBoard puzzle={puzzle} onSolved={handleSolved} />

      {phase === 'attribution' && questions[step] ? (
        <div className="mt-10 border-t pt-6" style={{ borderColor: 'rgba(10,17,31,0.2)' }}>
          <p
            className="font-[Bodoni_Moda,Georgia,serif] text-[26px] leading-tight"
            style={{ color: NAVY }}
          >
            {questions[step].prompt}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {questions[step].options.map((option) => {
              const isPicked = picked === option;
              const isAnswer = option === questions[step].answer;
              const show = picked !== null;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => answer(option)}
                  className="rounded-[3px] border px-4 py-3 text-left font-[Archivo,system-ui,sans-serif] text-[15px] transition-colors motion-safe:duration-150"
                  style={{
                    borderColor: show && isAnswer ? NAVY : isPicked ? RED : 'rgba(10,17,31,0.28)',
                    background: show && isAnswer ? NAVY : 'transparent',
                    color: show && isAnswer ? '#F2EDE4' : NAVY,
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {phase === 'reveal' ? (
        <div className="mt-10 border-t pt-6" style={{ borderColor: 'rgba(10,17,31,0.2)' }}>
          <p
            className="font-[Bodoni_Moda,Georgia,serif] text-[clamp(22px,5vw,34px)] leading-[1.15]"
            style={{ color: NAVY }}
          >
            {puzzle.kind === 'quote' ? `“${toSentence(puzzle.text)}”` : toSentence(puzzle.text)}
          </p>
          <p
            className="mt-3 font-[Archivo,system-ui,sans-serif] text-[15px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: RED }}
          >
            {puzzle.kind === 'quote'
              ? `${puzzle.speaker}, ${puzzle.year}`
              : `${puzzle.club}, ${puzzle.country}`}
          </p>
          {puzzle.reveal ? (
            <p
              className="mt-3 max-w-prose font-[Archivo,system-ui,sans-serif] text-[15px] leading-relaxed"
              style={{ color: 'rgba(10,17,31,0.72)' }}
            >
              {puzzle.reveal}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span
              className="rounded-full px-3 py-1 font-[Archivo,system-ui,sans-serif] text-[13px] font-semibold"
              style={{ background: NAVY, color: '#F2EDE4' }}
            >
              +{scoreFor(hints, attribution)} points
            </span>
            {questions.length > 0 ? (
              <span
                className="font-[Archivo,system-ui,sans-serif] text-[13px]"
                style={{ color: 'rgba(10,17,31,0.6)' }}
              >
                {attribution ? 'Attribution correct' : 'Attribution missed'}
              </span>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {hasNext ? (
              <button
                type="button"
                onClick={onNext}
                className="rounded-full px-6 py-3 font-[Archivo,system-ui,sans-serif] text-[14px] font-semibold uppercase tracking-[0.1em]"
                style={{ background: RED, color: '#F2EDE4' }}
              >
                Next code
              </button>
            ) : null}
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border px-6 py-3 font-[Archivo,system-ui,sans-serif] text-[14px] font-semibold uppercase tracking-[0.1em]"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Back to the chapter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function wordCount(text: string): number {
  return text.split(' ').filter(Boolean).length;
}

/** The grid is set in capitals; the reveal reads better in sentence case. */
function toSentence(text: string): string {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
