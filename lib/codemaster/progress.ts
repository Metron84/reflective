// Codemaster progress store.
// Browser localStorage for signed-out play. Signed-in users sync through
// /api/codemaster/* into Supabase (codemaster_solves). Merge never downgrades.

export interface SolvedRecord {
  score: number;
  hints: number;
  attribution: boolean;
  solvedAt: number;
}

export interface Progress {
  version: number;
  solved: Record<string, SolvedRecord>;
}

const KEY = 'trf.codemaster.v1';

const empty = (): Progress => ({ version: 1, solved: {} });

export function loadProgress(): Progress {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Progress;
    if (!parsed || typeof parsed !== 'object' || !parsed.solved) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

export function saveProgress(progress: Progress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // storage full or blocked; the session still plays, it just will not persist
  }
}

export function recordSolve(
  progress: Progress,
  puzzleId: string,
  record: Omit<SolvedRecord, 'solvedAt'>,
): Progress {
  const existing = progress.solved[puzzleId];
  // never downgrade a previous, better run
  if (existing && existing.score >= record.score) return progress;
  const next: Progress = {
    ...progress,
    solved: { ...progress.solved, [puzzleId]: { ...record, solvedAt: Date.now() } },
  };
  saveProgress(next);
  return next;
}

export function resetProgress(): Progress {
  const fresh = empty();
  saveProgress(fresh);
  return fresh;
}

export function totalScore(progress: Progress): number {
  return Object.values(progress.solved).reduce((sum, record) => sum + record.score, 0);
}

export function solvedCount(progress: Progress): number {
  return Object.keys(progress.solved).length;
}

export function chapterProgress(progress: Progress, puzzleIds: string[]): number {
  return puzzleIds.filter((id) => progress.solved[id]).length;
}

/**
 * How many codes a signed-out player gets before the wall.
 * Three is enough to learn the mechanic and finish a run of nicknames.
 */
export const FREE_PLAYS = 3;

/** True when a signed-out player has used their free codes and is opening a new one. */
export function needsAccount(
  progress: Progress,
  signedIn: boolean,
  puzzleId: string,
): boolean {
  if (signedIn) return false;
  // replaying something already solved never costs a play
  if (progress.solved[puzzleId]) return false;
  return solvedCount(progress) >= FREE_PLAYS;
}

/**
 * A chapter unlocks when the one before it is at least 60% solved.
 * The journey stays a journey, but a single stubborn grid never blocks it.
 */
export const UNLOCK_RATIO = 0.6;

export function chapterIsUnlocked(
  progress: Progress,
  chapters: { puzzleIds: string[] }[],
  index: number,
): boolean {
  if (index === 0) return true;
  const previous = chapters[index - 1];
  const done = chapterProgress(progress, previous.puzzleIds);
  return done >= Math.ceil(previous.puzzleIds.length * UNLOCK_RATIO);
}
