'use client';

import {
  nextRank,
  rankFor,
  type Chapter,
  type Puzzle,
  type Rank,
} from '@/lib/codemaster/engine';
import {
  FREE_PLAYS,
  chapterIsUnlocked,
  chapterProgress,
  solvedCount,
  totalScore,
  type Progress,
} from '@/lib/codemaster/progress';

const NAVY = '#0A111F';
const CREAM = '#F2EDE4';
const RED = '#D8232A';

interface Props {
  chapters: Chapter[];
  ranks: Rank[];
  totalPuzzles: number;
  progress: Progress;
  signedIn: boolean;
  onOpenChapter: (index: number) => void;
}

export default function JourneyMap({
  chapters,
  ranks,
  totalPuzzles,
  progress,
  signedIn,
  onOpenChapter,
}: Props) {
  const done = solvedCount(progress);
  const rank = rankFor(done, ranks);
  const upcoming = nextRank(done, ranks);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-10">
      <p
        className="font-[Archivo,system-ui,sans-serif] text-[12px] font-semibold uppercase tracking-[0.28em]"
        style={{ color: RED }}
      >
        The Reflective Football
      </p>
      <h1
        className="mt-2 font-[Bodoni_Moda,Georgia,serif] text-[clamp(46px,13vw,104px)] leading-[0.88]"
        style={{ color: NAVY }}
      >
        Codemaster
      </h1>
      <p
        className="mt-4 max-w-prose font-[Archivo,system-ui,sans-serif] text-[16px] leading-relaxed"
        style={{ color: 'rgba(10,17,31,0.75)' }}
      >
        Every grid holds something football already said out loud. The letters are
        there, stacked in their own columns, in the wrong order. Drop them back into
        place, then name who said it.
      </p>

      {/* rank strip */}
      <div
        className="mt-8 rounded-[3px] px-5 py-4"
        style={{ background: NAVY, color: CREAM }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <span className="font-[Bodoni_Moda,Georgia,serif] text-[30px] leading-none">
            {rank.title}
          </span>
          <span className="font-[Archivo,system-ui,sans-serif] text-[13px] tabular-nums opacity-80">
            {done} of {totalPuzzles} codes · {totalScore(progress)} points
          </span>
        </div>
        <p className="mt-1 font-[Archivo,system-ui,sans-serif] text-[14px] opacity-75">
          {rank.note}
        </p>
        <div className="mt-4 h-[3px] w-full" style={{ background: 'rgba(242,237,228,0.25)' }}>
          <div
            className="h-full"
            style={{
              width: `${Math.max(1, Math.round((done / totalPuzzles) * 100))}%`,
              background: RED,
            }}
          />
        </div>
        {!signedIn ? (
          <p className="mt-3 font-[Archivo,system-ui,sans-serif] text-[13px] opacity-80">
            {done >= FREE_PLAYS
              ? 'Free codes used. Sign in to keep going and to save your rank.'
              : `${FREE_PLAYS - done} free ${FREE_PLAYS - done === 1 ? 'code' : 'codes'} left. Progress saves to this browser until you sign in.`}
          </p>
        ) : null}
        {upcoming ? (
          <p className="mt-2 font-[Archivo,system-ui,sans-serif] text-[13px] opacity-70">
            {upcoming.at - done} more to reach {upcoming.title}.
          </p>
        ) : (
          <p className="mt-2 font-[Archivo,system-ui,sans-serif] text-[13px] opacity-70">
            Nothing left to decode. You are the Codemaster.
          </p>
        )}
      </div>

      {/* chapter spine */}
      <ol className="mt-10">
        {chapters.map((chapter, index) => {
          const solved = chapterProgress(progress, chapter.puzzleIds);
          const unlocked = chapterIsUnlocked(progress, chapters, index);
          const complete = solved === chapter.puzzleIds.length;
          return (
            <li key={chapter.key}>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => onOpenChapter(index)}
                className="group flex w-full items-start gap-4 border-t py-5 text-left disabled:cursor-not-allowed"
                style={{ borderColor: 'rgba(10,17,31,0.18)', opacity: unlocked ? 1 : 0.38 }}
              >
                <span
                  className="mt-1 w-10 shrink-0 font-[Archivo,system-ui,sans-serif] text-[13px] font-semibold tabular-nums"
                  style={{ color: complete ? RED : 'rgba(10,17,31,0.45)' }}
                >
                  {String(chapter.number).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block font-[Bodoni_Moda,Georgia,serif] text-[clamp(22px,5vw,30px)] leading-tight"
                    style={{ color: NAVY }}
                  >
                    {chapter.title}
                  </span>
                  <span
                    className="mt-1 block font-[Archivo,system-ui,sans-serif] text-[14px]"
                    style={{ color: 'rgba(10,17,31,0.65)' }}
                  >
                    {chapter.subtitle}
                  </span>
                  <span
                    className="mt-2 block font-[Archivo,system-ui,sans-serif] text-[12px] uppercase tracking-[0.12em] tabular-nums"
                    style={{ color: 'rgba(10,17,31,0.5)' }}
                  >
                    {unlocked
                      ? `${solved} / ${chapter.puzzleIds.length} decoded`
                      : 'Locked. Finish the chapter above.'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface ChapterProps {
  chapter: Chapter;
  puzzles: Record<string, Puzzle>;
  progress: Progress;
  onPlay: (indexInChapter: number) => void;
  onBack: () => void;
}

export function ChapterView({ chapter, puzzles, progress, onPlay, onBack }: ChapterProps) {
  const solved = chapterProgress(progress, chapter.puzzleIds);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8">
      <button
        type="button"
        onClick={onBack}
        className="font-[Archivo,system-ui,sans-serif] text-[13px] uppercase tracking-[0.12em]"
        style={{ color: 'rgba(10,17,31,0.6)' }}
      >
        ← The journey
      </button>

      <p
        className="mt-6 font-[Archivo,system-ui,sans-serif] text-[12px] font-semibold uppercase tracking-[0.24em]"
        style={{ color: RED }}
      >
        Chapter {String(chapter.number).padStart(2, '0')}
      </p>
      <h2
        className="mt-1 font-[Bodoni_Moda,Georgia,serif] text-[clamp(34px,9vw,60px)] leading-[0.95]"
        style={{ color: NAVY }}
      >
        {chapter.title}
      </h2>
      <p
        className="mt-3 max-w-prose font-[Archivo,system-ui,sans-serif] text-[16px]"
        style={{ color: 'rgba(10,17,31,0.7)' }}
      >
        {chapter.subtitle}
      </p>
      <p
        className="mt-2 font-[Archivo,system-ui,sans-serif] text-[13px] uppercase tracking-[0.12em] tabular-nums"
        style={{ color: 'rgba(10,17,31,0.5)' }}
      >
        {solved} / {chapter.puzzleIds.length} decoded
      </p>

      <div className="mt-8 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {chapter.puzzleIds.map((id, index) => {
          const record = progress.solved[id];
          const puzzle = puzzles[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPlay(index)}
              aria-label={`Puzzle ${index + 1}${record ? ', solved' : ''}`}
              className="flex aspect-square flex-col items-center justify-center rounded-[3px] border font-[Archivo,system-ui,sans-serif] transition-colors motion-safe:duration-150"
              style={{
                borderColor: record ? NAVY : 'rgba(10,17,31,0.28)',
                background: record ? NAVY : 'transparent',
                color: record ? CREAM : NAVY,
              }}
            >
              <span className="text-[17px] font-semibold tabular-nums">{index + 1}</span>
              <span className="mt-0.5 text-[10px] uppercase tracking-[0.08em] opacity-70">
                {record ? `${record.score}` : `${puzzle?.letters ?? ''}`}
              </span>
            </button>
          );
        })}
      </div>
      <p
        className="mt-4 font-[Archivo,system-ui,sans-serif] text-[12px]"
        style={{ color: 'rgba(10,17,31,0.5)' }}
      >
        Unsolved tiles show the letter count. Solved tiles show your score.
      </p>
    </div>
  );
}
