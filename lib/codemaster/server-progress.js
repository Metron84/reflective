import { getServiceClient } from "@/lib/supabase";

/**
 * @typedef {{ score: number, hints: number, attribution: boolean, solvedAt: number }} SolvedRecord
 * @typedef {{ version: number, solved: Record<string, SolvedRecord> }} Progress
 */

/** @returns {Progress} */
export function emptyProgress() {
  return { version: 1, solved: {} };
}

/**
 * Keep the better score; never downgrade.
 * @param {Progress} a
 * @param {Progress} b
 * @returns {Progress}
 */
export function mergeProgressMaps(a, b) {
  const solved = { ...(a?.solved ?? {}) };
  for (const [puzzleId, record] of Object.entries(b?.solved ?? {})) {
    const existing = solved[puzzleId];
    if (!existing || record.score > existing.score) {
      solved[puzzleId] = record;
    } else if (
      existing &&
      record.score === existing.score &&
      record.solvedAt < existing.solvedAt
    ) {
      solved[puzzleId] = { ...existing, solvedAt: record.solvedAt };
    }
  }
  return { version: 1, solved };
}

/**
 * @param {Array<{ puzzle_id: string, score: number, hints: number, attribution: boolean, solved_at: string }>} rows
 * @returns {Progress}
 */
export function progressFromRows(rows) {
  /** @type {Progress} */
  const progress = emptyProgress();
  for (const row of rows ?? []) {
    progress.solved[row.puzzle_id] = {
      score: Number(row.score) || 0,
      hints: Number(row.hints) || 0,
      attribution: Boolean(row.attribution),
      solvedAt: row.solved_at ? Date.parse(row.solved_at) || Date.now() : Date.now(),
    };
  }
  return progress;
}

/**
 * @param {string} userId
 * @returns {Promise<Progress>}
 */
export async function loadUserCodemasterProgress(userId) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return emptyProgress();

  const { data, error } = await supabase
    .from("codemaster_solves")
    .select("puzzle_id, score, hints, attribution, solved_at")
    .eq("user_id", userId);

  if (error) return emptyProgress();
  return progressFromRows(data ?? []);
}

/**
 * Upsert solves that are new or better than stored scores.
 * @param {string} userId
 * @param {Progress} progress
 */
export async function upsertCodemasterProgress(userId, progress) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return;

  const entries = Object.entries(progress?.solved ?? {});
  if (entries.length === 0) return;

  const existing = await loadUserCodemasterProgress(userId);
  const rows = [];

  for (const [puzzleId, record] of entries) {
    const prev = existing.solved[puzzleId];
    if (prev && prev.score >= record.score) continue;
    rows.push({
      user_id: userId,
      puzzle_id: puzzleId,
      score: record.score,
      hints: record.hints,
      attribution: Boolean(record.attribution),
      solved_at: new Date(record.solvedAt || Date.now()).toISOString(),
    });
  }

  if (rows.length === 0) return;

  // Chunk to stay under payload limits for large local migrations.
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await supabase
      .from("codemaster_solves")
      .upsert(chunk, { onConflict: "user_id,puzzle_id" })
      .then(
        () => {},
        () => {}
      );
  }
}

/**
 * @param {string} userId
 * @param {string} puzzleId
 * @param {{ score: number, hints: number, attribution: boolean, solvedAt?: number }} record
 */
export async function upsertCodemasterSolve(userId, puzzleId, record) {
  const supabase = getServiceClient();
  if (!supabase || !userId || !puzzleId) return;

  const existing = await loadUserCodemasterProgress(userId);
  const prev = existing.solved[puzzleId];
  if (prev && prev.score >= record.score) return;

  await supabase
    .from("codemaster_solves")
    .upsert(
      {
        user_id: userId,
        puzzle_id: puzzleId,
        score: record.score,
        hints: record.hints,
        attribution: Boolean(record.attribution),
        solved_at: new Date(record.solvedAt || Date.now()).toISOString(),
      },
      { onConflict: "user_id,puzzle_id" }
    )
    .then(
      () => {},
      () => {}
    );
}

/**
 * @param {string} userId
 */
export async function clearUserCodemasterProgress(userId) {
  const supabase = getServiceClient();
  if (!supabase || !userId) return;
  await supabase
    .from("codemaster_solves")
    .delete()
    .eq("user_id", userId)
    .then(
      () => {},
      () => {}
    );
}
