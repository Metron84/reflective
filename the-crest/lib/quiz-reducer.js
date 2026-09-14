import { COLOR_RANK_COUNT, normalizeHatedColors } from "./colour-veto.js";
import { emptySensesAnswers, isSensesComplete } from "./senses.js";
import { normalizeLeagueScope } from "./scope.js";
import {
  AFFINITY_COUNT,
  COLOR_STEP_INDEX,
  KIT_FAMILIES,
  PILLAR_STEP_INDEX,
  QUIZ_STEP_COUNT,
  SENSES_END,
  SENSES_START,
  STORAGE_KEY,
  flowAt,
} from "./quiz-content.js";

export { QUIZ_STEP_COUNT as TOTAL_QUIZ_QUESTIONS };

/** @typedef {'start' | 'scope' | 'owned' | 'quiz' | 'complete'} Step */

export function emptyCharacter() {
  return {
    integrity: null,
    decency: null,
    respect: null,
    power: null,
  };
}

export function initialState() {
  return {
    step: "start",
    quizIndex: 0,
    scores: Array(AFFINITY_COUNT).fill(null),
    character: emptyCharacter(),
    ownedSlugs: [],
    noClubYet: false,
    pillar: null,
    hatedColors: [],
    leagueScope: "all",
    sensesAnswers: emptySensesAnswers(),
  };
}

export function isCharacterComplete(character) {
  return (
    character.integrity != null &&
    character.decency != null &&
    character.respect != null &&
    character.power != null
  );
}

export function isQuizComplete(state) {
  return (
    state.scores.every((s) => s != null) &&
    isSensesComplete(state.sensesAnswers) &&
    isCharacterComplete(state.character) &&
    state.pillar != null &&
    normalizeHatedColors(state.hatedColors ?? state.hatedColor).length ===
      COLOR_RANK_COUNT
  );
}

/** @param {QuizState} state */
export function countQuizAnswers(state) {
  let n = 0;
  for (const s of state.scores) {
    if (s != null) n += 1;
  }
  for (const s of state.sensesAnswers ?? []) {
    if (s != null) n += 1;
  }
  const c = state.character;
  if (c.integrity != null) n += 1;
  if (c.decency != null) n += 1;
  if (c.respect != null) n += 1;
  if (c.power != null) n += 1;
  if (state.pillar != null) n += 1;
  if (
    normalizeHatedColors(state.hatedColors ?? state.hatedColor).length ===
    COLOR_RANK_COUNT
  ) {
    n += 1;
  }
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
    const character = {
      ...emptyCharacter(),
      ...(parsed.character && typeof parsed.character === "object"
        ? parsed.character
        : {}),
    };
    const sensesAnswers = Array.isArray(parsed.sensesAnswers)
      ? parsed.sensesAnswers
          .slice(0, 5)
          .concat(emptySensesAnswers())
          .slice(0, 5)
      : emptySensesAnswers();
    return {
      ...initialState(),
      ...parsed,
      scores,
      character,
      sensesAnswers,
      leagueScope: normalizeLeagueScope(parsed.leagueScope),
      ownedSlugs: Array.isArray(parsed.ownedSlugs) ? parsed.ownedSlugs : [],
      hatedColors: normalizeHatedColors(
        parsed.hatedColors ?? parsed.hatedColor ?? [],
      ),
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
 * @param {QuizState} state
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
    case "TOGGLE_OWNED": {
      const slug = /** @type {string} */ (action.payload);
      const has = state.ownedSlugs.includes(slug);
      return {
        ...state,
        noClubYet: false,
        ownedSlugs: has
          ? state.ownedSlugs.filter((s) => s !== slug)
          : [...state.ownedSlugs, slug],
      };
    }
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
    case "OWNED_CONTINUE":
      return { ...state, step: "quiz", quizIndex: 0 };
    case "ANSWER_DIMENSION": {
      const { index, value } = /** @type {{ index: number; value: number }} */ (
        action.payload
      );
      const scores = [...state.scores];
      scores[index] = value;
      return { ...state, scores, quizIndex: state.quizIndex + 1 };
    }
    case "ANSWER_SENSE": {
      const { index, value } = /** @type {{ index: number; value: number }} */ (
        action.payload
      );
      const sensesAnswers = [...(state.sensesAnswers ?? emptySensesAnswers())];
      sensesAnswers[index] = value;
      return { ...state, sensesAnswers, quizIndex: state.quizIndex + 1 };
    }
    case "ANSWER_CHARACTER": {
      const { key, value } = /** @type {{ key: string; value: number }} */ (
        action.payload
      );
      const character = { ...state.character, [key]: value };
      return { ...state, character, quizIndex: state.quizIndex + 1 };
    }
    case "ANSWER_PILLAR": {
      const pillar = /** @type {{ Heart: number; Mind: number; Soul: number }} */ (
        action.payload
      );
      return { ...state, pillar, quizIndex: COLOR_STEP_INDEX };
    }
    case "ANSWER_COLOR": {
      const color = /** @type {string} */ (action.payload);
      if (!KIT_FAMILIES.includes(color)) return state;
      const current = normalizeHatedColors(state.hatedColors ?? state.hatedColor);
      const idx = current.indexOf(color);
      const next =
        idx >= 0
          ? current.filter((c) => c !== color)
          : current.length < COLOR_RANK_COUNT
            ? [...current, color]
            : current;
      if (next.length === COLOR_RANK_COUNT) {
        return { ...state, hatedColors: next, step: "complete" };
      }
      return { ...state, hatedColors: next };
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

export { flowAt, SENSES_START, SENSES_END, PILLAR_STEP_INDEX };
