import { MAX_QUESTIONS, wheel } from "./game.js";

function trailingStreak(state) {
  let n = 0;
  const answers = state?.answers ?? [];
  for (let i = answers.length - 1; i >= 0; i -= 1) {
    if (!answers[i].correct) break;
    n += 1;
  }
  return n;
}

/**
 * Safe view of an in-progress game. The answer is included only after it has
 * already been revealed. Null means there is nothing to resume.
 */
export function publicSession(row, questions, now = Date.now()) {
  if (!row?.id || !row.state || row.completed_at) return null;
  const state = row.state;
  if (state.phase === "finished") return { sessionId: row.id, phase: "finished" };

  const base = {
    sessionId: row.id,
    categories: wheel(state),
    score: state.score ?? 0,
    answered: state.answered ?? 0,
    maxQuestions: MAX_QUESTIONS,
    streak: trailingStreak(state),
    phase: state.phase,
  };

  if (state.phase === "question" && state.pending) {
    const q = questions.find((item) => item.id === state.pending.questionId);
    if (!q) return null;
    const secondsLeft = Math.max(0, Math.ceil((state.pending.deadline - now) / 1000));
    return {
      ...base,
      spin: {
        category: q.category,
        value: q.value,
        questionId: q.id,
        clue: q.clue,
        deadline: state.pending.deadline,
        answerSeconds: secondsLeft,
      },
    };
  }

  if (state.phase === "continue") {
    const last = state.answers?.at?.(-1) ?? null;
    const q = last ? questions.find((item) => item.id === last.questionId) : null;
    return {
      ...base,
      spin: q
        ? {
            category: q.category,
            value: q.value,
            questionId: q.id,
            clue: q.clue,
            answerSeconds: 0,
          }
        : null,
      result: {
        correct: !!last?.correct,
        timedOut: !!last?.timedOut,
        pointsChange: last?.pointsChange ?? 0,
        score: state.score ?? 0,
        answered: state.answered ?? 0,
        answer: q?.answer ?? "",
        next: "continuePrompt",
      },
    };
  }

  return base;
}
