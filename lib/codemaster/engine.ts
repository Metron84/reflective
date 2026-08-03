// Codemaster puzzle engine
// Pure logic. No React, no DOM. Safe to unit test in isolation.

export type PuzzleKind = 'nickname' | 'motto' | 'quote';

export interface Puzzle {
  id: string;
  kind: PuzzleKind;
  text: string;
  letters: number;
  answerLabel: string;
  reveal: string;
  // quote puzzles
  speaker?: string;
  role?: string;
  year?: number;
  lane?: 'premier-league' | 'world';
  // club puzzles
  prompt?: string;
  club?: string;
  country?: string;
  league?: string;
  founded?: string;
}

export interface Chapter {
  key: string;
  number: number;
  title: string;
  subtitle: string;
  kind: PuzzleKind;
  puzzleIds: string[];
}

export interface Rank {
  key: string;
  title: string;
  at: number;
  note: string;
}

export interface CodemasterData {
  version: number;
  title: string;
  totalPuzzles: number;
  totalChapters: number;
  ranks: Rank[];
  chapters: Chapter[];
  puzzles: Record<string, Puzzle>;
}

export type CellKind = 'letter' | 'gap' | 'fixed' | 'void';

export interface Cell {
  row: number;
  col: number;
  kind: CellKind;
  /** the correct letter for a `letter` cell */
  solution?: string;
  /** the printed character for a `fixed` cell (punctuation) */
  char?: string;
}

export interface Grid {
  width: number;
  rows: number;
  cells: Cell[][];
  /** per column, the scrambled letters the solver must place */
  bank: string[][];
}

/* ------------------------------------------------------------------ */
/* deterministic randomness                                            */
/* ------------------------------------------------------------------ */

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates with a seeded generator, so a puzzle scrambles the same way every time. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed));
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* grid construction                                                   */
/* ------------------------------------------------------------------ */

const LETTER = /^[A-Z]$/;

export function longestWord(text: string): number {
  return text.split(' ').reduce((longest, word) => Math.max(longest, word.length), 0);
}

/**
 * Grid width for a given text and viewport.
 * Mobile first, but never narrower than the longest word: a word that breaks
 * across two rows is the single most confusing thing a solver can be shown.
 */
export function gridWidthFor(text: string, maxWidth: number): number {
  // A single word has nothing to be confused with, so it may wrap onto itself.
  // Laying it out on one line would leave one letter per column and no puzzle.
  if (!text.includes(' ')) {
    return Math.max(4, Math.min(maxWidth, Math.ceil(text.length / 3)));
  }
  const balanced = Math.round(Math.sqrt(text.length * 1.6));
  const needed = longestWord(text);
  return Math.max(7, needed, Math.min(maxWidth, balanced));
}

export function maxWidthForViewport(viewportWidth: number): number {
  if (viewportWidth < 420) return 11;
  if (viewportWidth < 640) return 13;
  if (viewportWidth < 1024) return 15;
  return 18;
}

/**
 * Wrap the text into rows of at most `width` characters, breaking on spaces.
 * A word only splits when it is longer than the grid itself.
 */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    let remaining = word;
    while (remaining.length > width) {
      if (line.length > 0) {
        lines.push(line);
        line = '';
      }
      lines.push(remaining.slice(0, width));
      remaining = remaining.slice(width);
    }
    if (line.length === 0) {
      line = remaining;
    } else if (line.length + 1 + remaining.length <= width) {
      line += ` ${remaining}`;
    } else {
      lines.push(line);
      line = remaining;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.length > 0 ? lines : [''];
}

/**
 * Lay the wrapped text into a rectangle of `width` columns.
 * Cells past the end of a line are blocked, so every row reads as whole words.
 */
export function buildGrid(puzzle: Puzzle, width: number): Grid {
  const lines = wrapText(puzzle.text, width);
  const rows = lines.length;
  const cells: Cell[][] = [];

  for (let r = 0; r < rows; r += 1) {
    const rowCells: Cell[] = [];
    const chars = lines[r].split('');
    for (let c = 0; c < width; c += 1) {
      const ch = chars[c];
      if (ch === undefined) {
        rowCells.push({ row: r, col: c, kind: 'void' });
      } else if (ch === ' ') {
        rowCells.push({ row: r, col: c, kind: 'gap' });
      } else if (LETTER.test(ch)) {
        rowCells.push({ row: r, col: c, kind: 'letter', solution: ch });
      } else {
        rowCells.push({ row: r, col: c, kind: 'fixed', char: ch });
      }
    }
    cells.push(rowCells);
  }

  const bank: string[][] = [];
  for (let c = 0; c < width; c += 1) {
    const column: string[] = [];
    for (let r = 0; r < rows; r += 1) {
      const cell = cells[r][c];
      if (cell.kind === 'letter' && cell.solution) column.push(cell.solution);
    }
    bank.push(seededShuffle(column, `${puzzle.id}:${width}:${c}`));
  }

  return { width, rows, cells, bank };
}

/** Rows that contain no playable letters at all (rare, but they break row checks). */
export function rowHasLetters(grid: Grid, row: number): boolean {
  return grid.cells[row].some((cell) => cell.kind === 'letter');
}

export function rowIsFull(grid: Grid, placed: (string | null)[][], row: number): boolean {
  return grid.cells[row].every(
    (cell) => cell.kind !== 'letter' || placed[row][cell.col] !== null,
  );
}

export function rowIsCorrect(grid: Grid, placed: (string | null)[][], row: number): boolean {
  return grid.cells[row].every(
    (cell) => cell.kind !== 'letter' || placed[row][cell.col] === cell.solution,
  );
}

export function puzzleIsSolved(grid: Grid, placed: (string | null)[][]): boolean {
  for (let r = 0; r < grid.rows; r += 1) {
    if (!rowIsCorrect(grid, placed, r)) return false;
  }
  return true;
}

/** Reads the grid back as a single line, using an underscore for anything unplaced. */
export function readGrid(grid: Grid, placed: (string | null)[][]): string {
  const lines: string[] = [];
  for (let r = 0; r < grid.rows; r += 1) {
    let line = '';
    for (let c = 0; c < grid.width; c += 1) {
      const cell = grid.cells[r][c];
      if (cell.kind === 'void') continue;
      if (cell.kind === 'gap') line += ' ';
      else if (cell.kind === 'fixed') line += cell.char;
      else line += placed[r][c] ?? '_';
    }
    lines.push(line);
  }
  return lines.join(' ');
}

/* ------------------------------------------------------------------ */
/* hints                                                               */
/* ------------------------------------------------------------------ */

export interface HintResult {
  row: number;
  col: number;
  letter: string;
  /** index into bank[col] of the tile that should be consumed */
  bankIndex: number;
}

/**
 * Picks one unsolved cell and returns the placement that fixes it.
 * Prefers cells in the row nearest the top, so a hint always opens up reading.
 */
export function findHint(
  grid: Grid,
  placed: (string | null)[][],
  bankUsed: boolean[][],
): HintResult | null {
  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.width; c += 1) {
      const cell = grid.cells[r][c];
      if (cell.kind !== 'letter' || !cell.solution) continue;
      if (placed[r][c] === cell.solution) continue;
      const bankIndex = grid.bank[c].findIndex(
        (letter, i) => letter === cell.solution && !bankUsed[c][i],
      );
      if (bankIndex === -1) continue;
      return { row: r, col: c, letter: cell.solution, bankIndex };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* scoring                                                             */
/* ------------------------------------------------------------------ */

export const SCORE = {
  base: 100,
  hintCost: 15,
  attributionBonus: 50,
  minimum: 20,
};

export function scoreFor(hintsUsed: number, attributionCorrect: boolean): number {
  const raw = SCORE.base - hintsUsed * SCORE.hintCost;
  const floored = Math.max(SCORE.minimum, raw);
  return floored + (attributionCorrect ? SCORE.attributionBonus : 0);
}

/* ------------------------------------------------------------------ */
/* attribution round                                                   */
/* ------------------------------------------------------------------ */

export interface AttributionQuestion {
  prompt: string;
  answer: string;
  options: string[];
}

/**
 * Builds the second lock: solving the grid is not the whole puzzle,
 * the solver still has to say who said it and when.
 */
export function buildAttribution(
  puzzle: Puzzle,
  allPuzzles: Puzzle[],
): AttributionQuestion[] {
  const questions: AttributionQuestion[] = [];

  const distractors = (answer: string, pool: string[], count: number, seed: string) => {
    const unique = Array.from(new Set(pool.filter((v) => v && v !== answer)));
    return seededShuffle(unique, seed).slice(0, count);
  };

  if (puzzle.kind === 'quote' && puzzle.speaker) {
    const pool = allPuzzles
      .filter((p) => p.kind === 'quote' && p.speaker && p.role === puzzle.role)
      .map((p) => p.speaker as string);
    const wide = allPuzzles.filter((p) => p.kind === 'quote').map((p) => p.speaker as string);
    const wrong = distractors(puzzle.speaker, pool.length >= 3 ? pool : wide, 3, `${puzzle.id}:sp`);
    questions.push({
      prompt: 'Who said it?',
      answer: puzzle.speaker,
      options: seededShuffle([puzzle.speaker, ...wrong], `${puzzle.id}:spo`),
    });

    if (puzzle.year) {
      const answer = String(puzzle.year);
      const near = [puzzle.year - 3, puzzle.year - 1, puzzle.year + 2, puzzle.year + 4]
        .filter((y) => y >= 2006 && y <= 2026)
        .map(String);
      const wrongYears = distractors(answer, near, 3, `${puzzle.id}:yr`);
      questions.push({
        prompt: 'What year?',
        answer,
        options: seededShuffle([answer, ...wrongYears], `${puzzle.id}:yro`),
      });
    }
  } else if (puzzle.club) {
    const pool = allPuzzles
      .filter((p) => p.club && p.country === puzzle.country)
      .map((p) => p.club as string);
    const wide = allPuzzles.filter((p) => p.club).map((p) => p.club as string);
    const wrong = distractors(puzzle.club, pool.length >= 3 ? pool : wide, 3, `${puzzle.id}:cl`);
    questions.push({
      prompt: 'Which club?',
      answer: puzzle.club,
      options: seededShuffle([puzzle.club, ...wrong], `${puzzle.id}:clo`),
    });
  }

  return questions;
}

/* ------------------------------------------------------------------ */
/* ranks                                                               */
/* ------------------------------------------------------------------ */

export function rankFor(solvedCount: number, ranks: Rank[]): Rank {
  let current = ranks[0];
  for (const rank of ranks) {
    if (solvedCount >= rank.at) current = rank;
  }
  return current;
}

export function nextRank(solvedCount: number, ranks: Rank[]): Rank | null {
  return ranks.find((rank) => solvedCount < rank.at) ?? null;
}
