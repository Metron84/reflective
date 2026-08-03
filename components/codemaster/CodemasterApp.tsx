'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import JourneyMap, { ChapterView } from './JourneyMap';
import PlayView from './PlayView';
import SignupWall from './SignupWall';
import type { CodemasterData, Puzzle } from '@/lib/codemaster/engine';
import {
  loadProgress,
  needsAccount,
  recordSolve,
  resetProgress,
  saveProgress,
  type Progress,
} from '@/lib/codemaster/progress';

const CREAM = '#F2EDE4';
const NAVY = '#0A111F';
const AUTH_HREF = '/signin?next=/codemaster';

type View =
  | { name: 'journey' }
  | { name: 'chapter'; chapterIndex: number }
  | { name: 'play'; chapterIndex: number; puzzleIndex: number }
  | { name: 'wall'; chapterIndex: number };

interface Props {
  /** Server session from the page. Client also re-checks via /api/codemaster/progress. */
  signedIn?: boolean;
  signInHref?: string;
  createAccountHref?: string;
}

export default function CodemasterApp({
  signedIn: signedInProp = false,
  signInHref = AUTH_HREF,
  createAccountHref = AUTH_HREF,
}: Props) {
  const [data, setData] = useState<CodemasterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ version: 1, solved: {} });
  const [signedIn, setSignedIn] = useState(signedInProp);
  const [view, setView] = useState<View>({ name: 'journey' });

  useEffect(() => {
    setSignedIn(signedInProp);
  }, [signedInProp]);

  useEffect(() => {
    const local = loadProgress();
    setProgress(local);
    let cancelled = false;

    const inlined = (window as unknown as { __CODEMASTER_DATA__?: CodemasterData })
      .__CODEMASTER_DATA__;
    if (inlined) {
      setData(inlined);
    } else {
      fetch('/codemaster/codemaster.json')
        .then((response) => {
          if (!response.ok) throw new Error(String(response.status));
          return response.json();
        })
        .then((json: CodemasterData) => {
          if (!cancelled) setData(json);
        })
        .catch(() => {
          if (!cancelled) setError('The puzzle set did not load. Refresh to try again.');
        });
    }

    fetch('/api/codemaster/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ local }),
    })
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload?.ok) return;
        setSignedIn(Boolean(payload.signedIn));
        if (payload.signedIn && payload.progress) {
          setProgress(payload.progress);
          saveProgress(payload.progress);
        }
      })
      .catch(() => {
        // Stay on local progress if the API is unreachable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allPuzzles: Puzzle[] = useMemo(
    () => (data ? Object.values(data.puzzles) : []),
    [data],
  );

  const handleComplete = useCallback(
    (puzzleId: string, result: { score: number; hints: number; attribution: boolean }) => {
      setProgress((current) =>
        recordSolve(current, puzzleId, {
          score: result.score,
          hints: result.hints,
          attribution: result.attribution,
        }),
      );

      if (signedIn) {
        fetch('/api/codemaster/solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            puzzleId,
            score: result.score,
            hints: result.hints,
            attribution: result.attribution,
          }),
        }).catch(() => {
          // Local progress already saved; cloud sync can catch up on next load.
        });
      }
    },
    [signedIn],
  );

  const handleReset = useCallback(async () => {
    if (!window.confirm('Clear every solved code and start the journey again?')) return;
    const fresh = resetProgress();
    setProgress(fresh);
    if (signedIn) {
      try {
        await fetch('/api/codemaster/progress', { method: 'DELETE' });
      } catch {
        // Local clear already applied.
      }
    }
  }, [signedIn]);

  if (error) {
    return (
      <main className="min-h-screen px-4 py-20" style={{ background: CREAM }}>
        <p
          className="mx-auto max-w-md font-[Archivo,system-ui,sans-serif] text-[16px]"
          style={{ color: NAVY }}
        >
          {error}
        </p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen px-4 py-20" style={{ background: CREAM }}>
        <p
          className="mx-auto max-w-md font-[Archivo,system-ui,sans-serif] text-[16px]"
          style={{ color: 'rgba(10,17,31,0.6)' }}
        >
          Loading the codes.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: CREAM }}>
      {view.name === 'journey' ? (
        <>
          <JourneyMap
            chapters={data.chapters}
            ranks={data.ranks}
            totalPuzzles={data.totalPuzzles}
            progress={progress}
            signedIn={signedIn}
            onOpenChapter={(chapterIndex) => setView({ name: 'chapter', chapterIndex })}
          />
          <div className="mx-auto w-full max-w-3xl px-4 pb-16">
            <button
              type="button"
              onClick={handleReset}
              className="font-[Archivo,system-ui,sans-serif] text-[12px] uppercase tracking-[0.12em] underline"
              style={{ color: 'rgba(10,17,31,0.45)' }}
            >
              Start the journey again
            </button>
          </div>
        </>
      ) : null}

      {view.name === 'chapter' ? (
        <ChapterView
          chapter={data.chapters[view.chapterIndex]}
          puzzles={data.puzzles}
          progress={progress}
          onBack={() => setView({ name: 'journey' })}
          onPlay={(puzzleIndex) => {
            const chapter = data.chapters[view.chapterIndex];
            const puzzleId = chapter.puzzleIds[puzzleIndex];
            if (needsAccount(progress, signedIn, puzzleId)) {
              setView({ name: 'wall', chapterIndex: view.chapterIndex });
              return;
            }
            setView({ name: 'play', chapterIndex: view.chapterIndex, puzzleIndex });
          }}
        />
      ) : null}

      {view.name === 'play'
        ? (() => {
            const chapter = data.chapters[view.chapterIndex];
            const puzzleId = chapter.puzzleIds[view.puzzleIndex];
            const puzzle = data.puzzles[puzzleId];
            const hasNext = view.puzzleIndex + 1 < chapter.puzzleIds.length;
            return (
              <PlayView
                key={puzzleId}
                puzzle={puzzle}
                chapter={chapter}
                indexInChapter={view.puzzleIndex}
                chapterSize={chapter.puzzleIds.length}
                allPuzzles={allPuzzles}
                alreadySolved={Boolean(progress.solved[puzzleId])}
                hasNext={hasNext}
                onComplete={(result) => handleComplete(puzzleId, result)}
                onNext={() => {
                  const nextId = chapter.puzzleIds[view.puzzleIndex + 1];
                  if (needsAccount(progress, signedIn, nextId)) {
                    setView({ name: 'wall', chapterIndex: view.chapterIndex });
                    return;
                  }
                  setView({
                    name: 'play',
                    chapterIndex: view.chapterIndex,
                    puzzleIndex: view.puzzleIndex + 1,
                  });
                }}
                onBack={() => setView({ name: 'chapter', chapterIndex: view.chapterIndex })}
              />
            );
          })()
        : null}

      {view.name === 'wall' ? (
        <SignupWall
          progress={progress}
          ranks={data.ranks}
          totalPuzzles={data.totalPuzzles}
          signInHref={signInHref}
          createAccountHref={createAccountHref}
          onBack={() => setView({ name: 'chapter', chapterIndex: view.chapterIndex })}
        />
      ) : null}
    </main>
  );
}
