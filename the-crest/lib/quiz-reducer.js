import { normalizeLeagueScope } from "./scope.js";
import {
  AFFINITY_COUNT,
  PILLAR_STEP_INDEX,
  QUIZ_STEP_COUNT,
  STORAGE_KEY,
  flowAt,
} from "./quiz-content.js";

export { QUIZ_STEP_COUNT as TOTAL_QUIZ_QUESTIONS };

/** @typedef {'start' | 'scope' | 'owned' | 'quiz' | 'complete'} Step */

export function initialState() {
  return {
    step: "start",
    quizIndex: 0,
    scores: Array(AFFINITY_COUNT).fill(null),
    ownedSlugs: [],
    noClubYet: false,
    pillar: null,
    leagueScope: "all",
  };
}

export function isQuizComplete(state) {
  return state.scores.every((s) => s != null) && state.pillar != null;
}

/** @param {ReturnType<typeof initialState>} state */
export function countQuizAnswers(state) {
  let n = 0;
  for (const s of state.scores) {
    if (s != null) n += 1;
  }
  if (state.pillar != null) n += 1;
  return n;
}

export function loadPersistedState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const scores = Array.isArray(parsed.scores)
      ? parsed.scores
          .slice(0, AFFINITY_COUNT)
          .concat(Array(AFFINITY_COUNT).fill(null))
          .slice(0, AFFINITY_COUNT)
      : Array(AFFINITY_COUNT).fill(null);
    return {
      ...initialState(),
      ...parsed,
      scores,
      character: undefined,
      sensesAnswers: undefined,
      hatedColors: undefined,
      leagueScope: normalizeLeagueScope(parsed.leagueScope),
      ownedSlugs: Array.isArray(parsed.ownedSlugs) ? parsed.ownedSlugs : [],
    };
  } catch {
    return null;
  }
}

export function persistState(state) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode */
  }
}

export function clearPersistedState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {ReturnType<typeof initialState>} state
 * @param {{ type: string; payload?: unknown }} action
 */
export function quizReducer(state, action) {
  switch (action.type) {
    case "START":
      return { ...state, step: "scope" };
    case "SET_SCOPE":
      return {
        ...state,
        leagueScope: normalizeLeagueScope(action.payload),
      };
    case "CONFIRM_SCOPE":
      return {
        ...state,
        leagueScope: normalizeLeagueScope(
          action.payload ?? state.leagueScope,
        ),
        step: "owned",
      };
    case "REMAP":
      return {
        ...state,
        leagueScope: normalizeLeagueScope(action.payload),
        step: "complete",
      };
    case "NO_CLUB_YET":
      return {
        ...state,
        noClubYet: true,
        ownedSlugs: [],
        step: "quiz",
        quizIndex: 0,
      };
    case "CHOOSE_OWNED":
      return {
        ...state,
        noClubYet: false,
        ownedSlugs: [/** @type {string} */ (action.payload)],
        step: "quiz",
        quizIndex: 0,
      };
    case "ANSWER_DIMENSION": {
      const { index, value } = /** @type {{ index: number; value: number }} */ (
        action.payload
      );
      const scores = [...state.scores];
      scores[index] = value;
      const nextIndex = state.quizIndex + 1;
      return { ...state, scores, quizIndex: nextIndex };
    }
    case "ANSWER_PILLAR": {
      const pillar = /** @type {{ Heart: number; Mind: number; Soul: number }} */ (
        action.payload
      );
      return { ...state, pillar, step: "complete", quizIndex: PILLAR_STEP_INDEX };
    }
    case "BACK": {
      if (state.step === "quiz" && state.quizIndex > 0) {
        return { ...state, quizIndex: state.quizIndex - 1 };
      }
      if (state.step === "quiz" && state.quizIndex === 0) {
        return { ...state, step: "owned" };
      }
      if (state.step === "owned") {
        return { ...state, step: "scope" };
      }
      if (state.step === "scope") {
        return { ...state, step: "start" };
      }
      return state;
    }
    case "RESTART":
      clearPersistedState();
      return initialState();
    default:
      return state;
  }
}

export { flowAt, PILLAR_STEP_INDEX };
