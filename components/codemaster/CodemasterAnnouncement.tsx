'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { buildGrid, type Puzzle } from '@/lib/codemaster/engine';

const NAVY = '#0A111F';
const CREAM = '#F2EDE4';
const RED = '#D8232A';

/** The teaser is the tagline itself, so solving it says what the network is for. */
const TEASER: Puzzle = {
  id: 'teaser-fans',
  kind: 'motto',
  text: 'WITHOUT THE FANS',
  letters: 14,
  answerLabel: 'The Reflective Football',
  reveal: 'Football is nothing without the fans.',
};

const WIDTH = 8;

/**
 * Homepage launch band. Not a poster for the game, a small piece of the game.
 * Fifteen letters, two rows, no instructions needed. Solving it is the invitation.
 */
export default function CodemasterAnnouncement() {
  const grid = useMemo(() => buildGrid(TEASER, WIDTH), []);
  const [placed, setPlaced] = useState<(string | null)[][]>(() =>
    grid.cells.map((row) => row.map(() => null)),
  );
  const [used, setUsed] = useState<boolean[][]>(() =>
    grid.bank.map((column) => column.map(() => false)),
  );

  const solved = grid.cells.every((row) =>
    row.every((cell) => cell.kind !== 'letter' || placed[cell.row][cell.col] === cell.solution),
  );
  const started = used.flat().some(Boolean);
  const full = used.flat().every(Boolean);

  const place = (col: number, index: number) => {
    if (solved || used[col][index]) return;
    const target = grid.cells.findIndex(
      (row) => row[col].kind === 'letter' && placed[row[col].row][col] === null,
    );
    if (target === -1) return;
    const nextPlaced = placed.map((row) => row.slice());
    nextPlaced[target][col] = grid.bank[col][index];
    const nextUsed = used.map((column) => column.slice());
    nextUsed[col][index] = true;
    setPlaced(nextPlaced);
    setUsed(nextUsed);
  };

  const lift = (row: number, col: number) => {
    const letter = placed[row][col];
    if (!letter || solved) return;
    const nextPlaced = placed.map((r) => r.slice());
    nextPlaced[row][col] = null;
    const nextUsed = used.map((column) => column.slice());
    const index = grid.bank[col].findIndex((value, i) => value === letter && nextUsed[col][i]);
    if (index !== -1) nextUsed[col][index] = false;
    setPlaced(nextPlaced);
    setUsed(nextUsed);
  };

  const columns = `repeat(${WIDTH}, minmax(0, 1fr))`;

  return (
    <section
      aria-labelledby="codemaster-announcement"
      style={{ background: NAVY, borderTop: '1px solid rgba(242,237,228,0.14)' }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-14 sm:px-6 md:flex-row md:items-center md:gap-16 md:py-16">
        {/* the grid comes first on mobile: play, then read */}
        <div className="w-full max-w-sm shrink-0 md:order-2">
          <div className="grid items-end gap-[3px]" style={{ gridTemplateColumns: columns }}>
            {grid.bank.map((column, col) => (
              <div key={col} className="flex flex-col justify-end gap-[3px]">
                {column.map((letter, index) =>
                  used[col][index] ? (
                    <div key={index} aria-hidden className="aspect-square w-full opacity-0" />
                  ) : (
                    <button
                      key={index}
                      type="button"
                      onClick={() => place(col, index)}
                      aria-label={`Place ${letter}`}
                      className="aspect-square w-full rounded-[2px] border font-[Archivo,system-ui,sans-serif] text-[clamp(13px,3.4vw,18px)] font-semibold leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{
                        borderColor: 'rgba(242,237,228,0.42)',
                        color: CREAM,
                        outlineColor: RED,
                      }}
                    >
                      {letter}
                    </button>
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="my-[7px] h-[3px] w-full" style={{ background: RED }} />

          <div className="flex flex-col gap-[3px]">
            {grid.cells.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="grid gap-[3px]"
                style={{ gridTemplateColumns: columns }}
              >
                {row.map((cell) => {
                  if (cell.kind !== 'letter') {
                    return (
                      <div
                        key={cell.col}
                        aria-hidden
                        className="aspect-square w-full rounded-[2px]"
                        style={{
                          background:
                            cell.kind === 'gap'
                              ? 'rgba(242,237,228,0.22)'
                              : 'rgba(242,237,228,0.07)',
                        }}
                      />
                    );
                  }
                  const letter = placed[rowIndex][cell.col];
                  return (
                    <button
                      key={cell.col}
                      type="button"
                      disabled={solved}
                      onClick={() => lift(rowIndex, cell.col)}
                      aria-label={letter ? `Lift ${letter}` : 'Empty square'}
                      className="aspect-square w-full rounded-[2px] border font-[Archivo,system-ui,sans-serif] text-[clamp(13px,3.4vw,18px)] font-semibold leading-none transition-colors motion-safe:duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default"
                      style={{
                        borderColor: letter ? CREAM : 'rgba(242,237,228,0.42)',
                        background: letter ? CREAM : 'transparent',
                        color: letter ? NAVY : CREAM,
                        outlineColor: RED,
                      }}
                    >
                      {letter ?? ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <p
            aria-live="polite"
            className="mt-4 font-[Archivo,system-ui,sans-serif] text-[13px]"
            style={{ color: solved ? CREAM : 'rgba(242,237,228,0.55)' }}
          >
            {solved
              ? 'Football is nothing without the fans. That was one of 670.'
              : full
                ? 'Not quite. Lift a letter and try it the other way round.'
                : started
                  ? 'Tap a placed letter to lift it back out.'
                  : 'Tap the letters. Each one falls into its own column.'}
          </p>
        </div>

        {/* the words */}
        <div className="min-w-0 md:order-1">
          <p
            className="font-[Archivo,system-ui,sans-serif] text-[12px] font-bold uppercase tracking-[0.28em]"
            style={{ color: RED }}
          >
            Games
          </p>
          <h2
            id="codemaster-announcement"
            className="mt-2 font-[Bodoni_Moda,Georgia,serif] text-[clamp(38px,9vw,64px)] leading-[0.92]"
            style={{ color: CREAM }}
          >
            Codemaster
          </h2>
          <p
            className="mt-3 max-w-md font-[Archivo,system-ui,sans-serif] text-[16px] leading-relaxed"
            style={{ color: 'rgba(242,237,228,0.72)' }}
          >
            Two decades of football, scrambled into 670 grids. Drop the letters back
            into place, name who said it, and work from Rookie to Codemaster.
          </p>
          <Link
            href="/codemaster"
            className="mt-6 inline-block rounded-full px-6 py-3 font-[Archivo,system-ui,sans-serif] text-[14px] font-semibold uppercase tracking-[0.1em]"
            style={{ background: RED, color: CREAM }}
          >
            {solved ? 'Take the next one' : 'Start decoding'}
          </Link>
        </div>
      </div>
    </section>
  );
}
