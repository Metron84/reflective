import { fail } from "./session.js";

/** 409 when a pending question id is not in the bank. Null when the id is present or there is no pending question. */
export function missingQuestion(state, questions) {
  const id = state?.pending?.questionId;
  if (!id || questions.some((q) => q.id === id)) return null;
  return fail(409, "question_missing");
}
