import { isCorrect } from "./match.js";
import { CELL_VALUES } from "./questions.js";

export const MAX_QUESTIONS = 10;
export const CONTINUE_AFTER = 5;
export const MAX_CATEGORIES = 8;
export const MAX_SKIPS = 2;
export const GRACE_MS = 2000;
/** Covers the wheel spin, the stop, and the pause before the clue. */
export const SPIN_ALLOWANCE_MS = 6500;

export const cellKey = (category, value) => `${category}|${value}`;

/** Categories where each of the five values has at least one question, capped at 8. */
export function activeCategories(qs) {
  const byCat = new Map();
  for (const q of qs) {
    if (!byCat.has(q.category)) byCat.set(q.category, new Set());
    byCat.get(q.category).add(q.value);
  }
  return [...byCat.entries()]
    .filter(([, vals]) => CELL_VALUES.every((v) => vals.has(v)))
    .map(([c]) => c)
    .slice(0, MAX_CATEGORIES);
}

export function newState(qs) {
  return {
    phase: "spin", // spin | question | continue | finished
    categories: activeCategories(qs),
    usedCells: [],
    served: [],
    pending: null, // { questionId, category, value, deadline }
    answers: [],
    score: 0,
    answered: 0,
    continued: false,
    skipsUsed: 0,
  };
}

/** Questions that can still be served: unused cell, no shared tag, no repeated answer. */
export function eligible(qs, state) {
  const byId = new Map(qs.map((q) => [q.id, q]));
  const servedQs = state.served.map((id) => byId.get(id)).filter(Boolean);
  const tags = new Set(servedQs.flatMap((q) => q.tags));
  const answers = new Set(servedQs.map((q) => q.answer));
  return qs.filter(
    (q) =>
      state.categories.includes(q.category) &&
      !state.usedCells.includes(cellKey(q.category, q.value)) &&
      !state.served.includes(q.id) &&
      !answers.has(q.answer) &&
      !q.tags.some((t) => tags.has(t)),
  );
}

/** A category leaves the wheel once all five of its cells are used. */
export function wheel(state) {
  return state.categories.map((name) => ({
    name,
    exhausted: CELL_VALUES.every((v) => state.usedCells.includes(cellKey(name, v))),
  }));
}

const pick = (xs, rand) => xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))];

/** Land on a category, then a random unused value in it, then one variant at random. */
export function pickSpin(qs, state, rand) {
  const pool = eligible(qs, state);
  if (!pool.length) return null;
  const category = pick([...new Set(pool.map((q) => q.category))], rand);
  const inCat = pool.filter((q) => q.category === category);
  const value = pick([...new Set(inCat.map((q) => q.value))], rand);
  return pick(
    inCat.filter((q) => q.value === value),
    rand,
  );
}

export function canSpin(state) {
  return state.phase === "spin" && !state.pending && state.answered < MAX_QUESTIONS;
}

export function applySpin(state, q, now, answerSeconds) {
  return {
    ...state,
    phase: "question",
    usedCells: [...state.usedCells, cellKey(q.category, q.value)],
    served: [...state.served, q.id],
    pending: {
      questionId: q.id,
      category: q.category,
      value: q.value,
      deadline: now + SPIN_ALLOWANCE_MS + answerSeconds * 1000,
    },
  };
}

/** Returns { state, correct, timedOut, pointsChange, next } or null when no question is pending. */
export function applyAnswer(qs, state, text, now) {
  const p = state.pending;
  if (state.phase !== "question" || !p) return null;
  const q = qs.find((x) => x.id === p.questionId);
  if (!q) return null;
  const timedOut = now > p.deadline + GRACE_MS;
  const correct = !timedOut && isCorrect(text, q);
  const pointsChange = correct ? p.value : -p.value;
  const answered = state.answered + 1;
  const base = {
    ...state,
    pending: null,
    score: state.score + pointsChange,
    answered,
    answers: [
      ...state.answers,
      { questionId: q.id, category: q.category, value: p.value, correct, timedOut, pointsChange },
    ],
  };
  return { ...settle(qs, base), correct, timedOut, pointsChange };
}

/** Shared tail of an answer and a skip: where the game goes after a question closes. */
function settle(qs, base) {
  let next;
  if (base.answered >= MAX_QUESTIONS || !eligible(qs, base).length) next = "finished";
  else if (base.answered === CONTINUE_AFTER && !base.continued) next = "continuePrompt";
  else next = "spin";
  const phase = next === "spin" ? "spin" : next === "continuePrompt" ? "continue" : "finished";
  return { state: { ...base, phase }, next };
}

export const skipsLeft = (state) => Math.max(0, MAX_SKIPS - (state.skipsUsed ?? 0));

/**
 * Skip the open question for 0 points. The cell and question id were already
 * marked used by the spin, and a skip counts towards the 10-question maximum.
 * Returns { error: "none" | "expired" | "no_skips" } or { state, next }.
 */
export function applySkip(qs, state, now) {
  const p = state.pending;
  if (state.phase !== "question" || !p) return { error: "none" };
  const q = qs.find((x) => x.id === p.questionId);
  if (!q) return { error: "none" };
  if (now > p.deadline) return { error: "expired" };
  if (skipsLeft(state) < 1) return { error: "no_skips" };
  const base = {
    ...state,
    pending: null,
    answered: state.answered + 1,
    skipsUsed: (state.skipsUsed ?? 0) + 1,
    answers: [
      ...state.answers,
      { questionId: q.id, category: q.category, value: p.value, correct: false, timedOut: false, skipped: true, pointsChange: 0 },
    ],
  };
  return settle(qs, base);
}

export function applyContinue(qs, state, yes) {
  if (state.phase !== "continue") return null;
  if (!yes || !eligible(qs, state).length) return { ...state, phase: "finished", continued: true };
  return { ...state, phase: "spin", continued: true };
}

export function summarize(state) {
  const correct = state.answers.filter((a) => a.correct).length;
  const skipped = state.answers.filter((a) => a.skipped).length;
  return {
    score: state.score,
    answered: state.answered,
    correct,
    incorrect: state.answered - correct - skipped,
    skipped,
    averagePoints: state.answered ? Math.round((state.score / state.answered) * 10) / 10 : 0,
  };
}

/** Finish is allowed any time no question is pending. */
export function canFinish(state) {
  return !state.pending && state.phase !== "question";
}
