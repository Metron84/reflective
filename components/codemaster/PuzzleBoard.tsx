'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildGrid,
  findHint,
  gridWidthFor,
  maxWidthForViewport,
  puzzleIsSolved,
  rowIsCorrect,
  rowIsFull,
  type Grid,
  type Puzzle,
} from '@/lib/codemaster/engine';

interface Props {
  puzzle: Puzzle;
  onSolved: (hintsUsed: number) => void;
}

const CREAM = '#F2EDE4';
const NAVY = '#0A111F';
const RED = '#D8232A';

function useMaxWidth(): number {
  const [maxWidth, setMaxWidth] = useState(11);
  useEffect(() => {
    const measure = () => setMaxWidth(maxWidthForViewport(window.innerWidth));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  return maxWidth;
}

export default function PuzzleBoard({ puzzle, onSolved }: Props) {
  const maxWidth = useMaxWidth();
  const width = useMemo(() => gridWidthFor(puzzle.text, maxWidth), [puzzle.text, maxWidth]);
  const grid: Grid = useMemo(() => buildGrid(puzzle, width), [puzzle, width]);

  const [placed, setPlaced] = useState<(string | null)[][]>([]);
  const [used, setUsed] = useState<boolean[][]>([]);
  const [locked, setLocked] = useState<boolean[]>([]);
  const [cursor, setCursor] = useState<{ row: number; col: number } | null>(null);
  // true only when the solver put the cursor there themselves, by tapping a cell.
  // An auto-advanced cursor guides typing but never hijacks a tapped bank letter.
  const [cursorIsChosen, setCursorIsChosen] = useState(false);
  const [wrongRow, setWrongRow] = useState<number | null>(null);
  const [hints, setHints] = useState(0);
  const [solved, setSolved] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // reset whenever the puzzle or the grid width changes
  useEffect(() => {
    setPlaced(grid.cells.map((row) => row.map(() => null)));
    setUsed(grid.bank.map((column) => column.map(() => false)));
    setLocked(grid.cells.map(() => false));
    setCursor(null);
    setCursorIsChosen(false);
    setWrongRow(null);
    setHints(0);
    setSolved(false);
  }, [grid]);

  const ready = placed.length === grid.rows && used.length === grid.width;

  const firstEmptyInColumn = useCallback(
    (col: number, state: (string | null)[][], lockedRows: boolean[]) => {
      for (let r = 0; r < grid.rows; r += 1) {
        if (lockedRows[r]) continue;
        const cell = grid.cells[r][col];
        if (cell.kind === 'letter' && state[r][col] === null) return r;
      }
      return -1;
    },
    [grid],
  );

  const advanceCursor = useCallback(
    (row: number, col: number, state: (string | null)[][], lockedRows: boolean[]) => {
      for (let r = row; r < grid.rows; r += 1) {
        for (let c = r === row ? col + 1 : 0; c < grid.width; c += 1) {
          if (lockedRows[r]) continue;
          const cell = grid.cells[r][c];
          if (cell.kind === 'letter' && state[r][c] === null) return { row: r, col: c };
        }
      }
      return null;
    },
    [grid],
  );

  const commit = useCallback(
    (
      nextPlaced: (string | null)[][],
      nextUsed: boolean[][],
      row: number,
      hintsUsed: number = hints,
    ) => {
      let nextLocked = locked;
      if (rowIsFull(grid, nextPlaced, row)) {
        if (rowIsCorrect(grid, nextPlaced, row)) {
          nextLocked = locked.map((value, i) => (i === row ? true : value));
          setLocked(nextLocked);
          setWrongRow(null);
        } else {
          setWrongRow(row);
          window.setTimeout(() => setWrongRow((current) => (current === row ? null : current)), 700);
        }
      }
      setPlaced(nextPlaced);
      setUsed(nextUsed);
      if (!solved && puzzleIsSolved(grid, nextPlaced)) {
        setSolved(true);
        onSolved(hintsUsed);
      }
      return nextLocked;
    },
    [grid, hints, locked, onSolved, solved],
  );

  const placeFromBank = useCallback(
    (col: number, bankIndex: number, atCursor = false) => {
      if (!ready || solved || used[col][bankIndex]) return;
      const useCursor =
        (atCursor || cursorIsChosen) &&
        cursor !== null &&
        cursor.col === col &&
        placed[cursor.row][col] === null &&
        !locked[cursor.row];
      const target = useCursor ? (cursor as { row: number; col: number }).row : firstEmptyInColumn(col, placed, locked);
      if (target === -1) return;

      const nextPlaced = placed.map((row) => row.slice());
      nextPlaced[target][col] = grid.bank[col][bankIndex];
      const nextUsed = used.map((column) => column.slice());
      nextUsed[col][bankIndex] = true;

      const nextLocked = commit(nextPlaced, nextUsed, target);
      setCursor(advanceCursor(target, col, nextPlaced, nextLocked));
      setCursorIsChosen(false);
    },
    [
      advanceCursor,
      commit,
      cursor,
      cursorIsChosen,
      firstEmptyInColumn,
      grid.bank,
      locked,
      placed,
      ready,
      solved,
      used,
    ],
  );

  const clearCell = useCallback(
    (row: number, col: number) => {
      if (!ready || solved || locked[row]) return;
      const letter = placed[row][col];
      if (!letter) {
        setCursor({ row, col });
        setCursorIsChosen(true);
        return;
      }
      const nextPlaced = placed.map((r) => r.slice());
      nextPlaced[row][col] = null;
      const nextUsed = used.map((column) => column.slice());
      const bankIndex = grid.bank[col].findIndex((value, i) => value === letter && nextUsed[col][i]);
      if (bankIndex !== -1) nextUsed[col][bankIndex] = false;
      setPlaced(nextPlaced);
      setUsed(nextUsed);
      setWrongRow(null);
      setCursor({ row, col });
      setCursorIsChosen(true);
    },
    [grid.bank, locked, placed, ready, solved, used],
  );

  const takeHint = useCallback(() => {
    if (!ready || solved) return;
    const hint = findHint(grid, placed, used);
    if (!hint) return;

    const nextPlaced = placed.map((row) => row.slice());
    const nextUsed = used.map((column) => column.slice());

    // if the wrong letter is sitting in that cell, send it home first
    const occupant = nextPlaced[hint.row][hint.col];
    if (occupant) {
      const idx = nextUsed[hint.col].findIndex(
        (isUsed, i) => isUsed && grid.bank[hint.col][i] === occupant,
      );
      if (idx !== -1) nextUsed[hint.col][idx] = false;
    }
    nextPlaced[hint.row][hint.col] = hint.letter;
    nextUsed[hint.col][hint.bankIndex] = true;

    const nextHints = hints + 1;
    setHints(nextHints);
    commit(nextPlaced, nextUsed, hint.row, nextHints);
  }, [commit, grid, placed, ready, solved, used]);

  const clearBoard = useCallback(() => {
    setPlaced(grid.cells.map((row) => row.map(() => null)));
    setUsed(grid.bank.map((column) => column.map(() => false)));
    setLocked(grid.cells.map(() => false));
    setCursor(null);
    setCursorIsChosen(false);
    setWrongRow(null);
  }, [grid]);

  // keyboard: type into the cursor cell, backspace to lift a letter
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!ready || solved) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Backspace' && cursor) {
        event.preventDefault();
        clearCell(cursor.row, cursor.col);
        return;
      }
      if (event.key === 'Escape') {
        setCursor(null);
        setCursorIsChosen(false);
        return;
      }
      const key = event.key.toUpperCase();
      if (!/^[A-Z]$/.test(key) || !cursor) return;
      const bankIndex = grid.bank[cursor.col].findIndex(
        (letter, i) => letter === key && !used[cursor.col][i],
      );
      if (bankIndex === -1) return;
      event.preventDefault();
      placeFromBank(cursor.col, bankIndex, true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearCell, cursor, grid.bank, placeFromBank, ready, solved, used]);

  if (!ready) return null;

  const columns = `repeat(${grid.width}, minmax(0, 1fr))`;
  const activeColumn = cursor?.col ?? -1;
  const remaining = used.flat().filter((value) => !value).length;

  return (
    <div ref={boardRef} className="w-full">
      {/* letter bank */}
      <div className="grid items-end gap-[2px]" style={{ gridTemplateColumns: columns }}>
        {grid.bank.map((column, col) => (
          <div key={col} className="flex flex-col justify-end gap-[2px]">
            {column.map((letter, index) =>
              used[col][index] ? (
                <div
                  key={index}
                  aria-hidden
                  className="aspect-square w-full rounded-[2px] opacity-0"
                />
              ) : (
                <button
                  key={index}
                  type="button"
                  onClick={() => placeFromBank(col, index)}
                  aria-label={`Place letter ${letter} in column ${col + 1}`}
                  className="aspect-square w-full rounded-[2px] border font-[Archivo,system-ui,sans-serif] text-[clamp(11px,2.6vw,20px)] font-semibold leading-none transition-colors motion-safe:duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    borderColor: col === activeColumn ? RED : 'rgba(10,17,31,0.35)',
                    background: col === activeColumn ? 'rgba(216,35,42,0.08)' : 'transparent',
                    color: NAVY,
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

      {/* the line letters fall through */}
      <div className="my-2 h-[3px] w-full" style={{ background: NAVY }} />

      {/* answer grid */}
      <div className="flex flex-col gap-[2px]">
        {grid.cells.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`grid gap-[2px] ${
              wrongRow === rowIndex ? 'motion-safe:animate-[cmShake_0.4s_ease-in-out]' : ''
            }`}
            style={{ gridTemplateColumns: columns }}
          >
            {row.map((cell) => {
              if (cell.kind === 'void' || cell.kind === 'gap') {
                return (
                  <div
                    key={cell.col}
                    aria-hidden
                    className="aspect-square w-full rounded-[2px]"
                    style={{
                      background:
                        cell.kind === 'gap' ? 'rgba(10,17,31,0.82)' : 'rgba(10,17,31,0.10)',
                    }}
                  />
                );
              }
              if (cell.kind === 'fixed') {
                return (
                  <div
                    key={cell.col}
                    className="flex aspect-square w-full items-center justify-center rounded-[2px] font-[Archivo,system-ui,sans-serif] text-[clamp(11px,2.6vw,20px)] leading-none"
                    style={{ color: 'rgba(10,17,31,0.45)' }}
                  >
                    {cell.char}
                  </div>
                );
              }

              const letter = placed[rowIndex][cell.col];
              const isLocked = locked[rowIndex];
              const isCursor =
                cursor?.row === rowIndex && cursor?.col === cell.col && !isLocked;
              const isWrong = wrongRow === rowIndex && letter !== null;

              return (
                <button
                  key={cell.col}
                  type="button"
                  disabled={isLocked}
                  onClick={() => clearCell(rowIndex, cell.col)}
                  aria-label={
                    letter
                      ? `Row ${rowIndex + 1}, column ${cell.col + 1}, letter ${letter}. Tap to lift.`
                      : `Row ${rowIndex + 1}, column ${cell.col + 1}, empty`
                  }
                  className="aspect-square w-full rounded-[2px] border font-[Archivo,system-ui,sans-serif] text-[clamp(11px,2.6vw,20px)] font-semibold leading-none transition-colors motion-safe:duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default"
                  style={{
                    borderColor: isLocked
                      ? NAVY
                      : isWrong
                        ? RED
                        : isCursor
                          ? RED
                          : 'rgba(10,17,31,0.28)',
                    borderWidth: isCursor || isWrong ? 2 : 1,
                    background: isLocked ? NAVY : isWrong ? 'rgba(216,35,42,0.12)' : 'transparent',
                    color: isLocked ? CREAM : NAVY,
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

      {/* controls */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={takeHint}
          disabled={solved}
          className="rounded-full border px-4 py-2 font-[Archivo,system-ui,sans-serif] text-[13px] font-semibold uppercase tracking-[0.08em] disabled:opacity-40"
          style={{ borderColor: NAVY, color: NAVY }}
        >
          Reveal a letter
        </button>
        <button
          type="button"
          onClick={clearBoard}
          disabled={solved}
          className="rounded-full border px-4 py-2 font-[Archivo,system-ui,sans-serif] text-[13px] font-semibold uppercase tracking-[0.08em] disabled:opacity-40"
          style={{ borderColor: 'rgba(10,17,31,0.3)', color: 'rgba(10,17,31,0.7)' }}
        >
          Start the grid again
        </button>
        <span
          className="ml-auto font-[Archivo,system-ui,sans-serif] text-[13px]"
          style={{ color: 'rgba(10,17,31,0.6)' }}
        >
          {remaining} letters left{hints > 0 ? ` · ${hints} revealed` : ''}
        </span>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html:
            '@keyframes cmShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}',
        }}
      />
    </div>
  );
}
