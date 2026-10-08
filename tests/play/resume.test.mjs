import assert from "node:assert/strict";
import { test } from "node:test";
import { publicSession } from "../../lib/play/resume.js";

const questions = [
  {
    id: "q1",
    category: "Arsenal",
    value: 200,
    clue: "Name the ground",
    answer: "SECRET ANSWER",
  },
];

function row(state, extra = {}) {
  return { id: "sess-1", state, ...extra };
}

test("an in-progress game keeps its round, score and streak", () => {
  const view = publicSession(
    row({
      phase: "spin",
      categories: ["Arsenal"],
      usedCells: ["Arsenal|200"],
      answers: [
        { questionId: "q1", correct: true },
        { questionId: "q1", correct: true },
      ],
      score: 400,
      answered: 2,
    }),
    questions,
    0,
  );
  assert.equal(view.answered, 2);
  assert.equal(view.score, 400);
  assert.equal(view.streak, 2);
  assert.equal(view.phase, "spin");
});

test("a pending question can be resumed without the answer", () => {
  const view = publicSession(
    row({
      phase: "question",
      categories: ["Arsenal"],
      usedCells: ["Arsenal|200"],
      pending: { questionId: "q1", deadline: 5_000 },
      answers: [],
      score: 0,
      answered: 0,
    }),
    questions,
    2_000,
  );
  assert.equal(view.sessionId, "sess-1");
  assert.equal(view.spin.clue, "Name the ground");
  assert.equal(view.spin.answerSeconds, 3);
  assert.equal(JSON.stringify(view).includes("SECRET ANSWER"), false);
});

test("a finished or missing game is not resumed", () => {
  assert.equal(publicSession(row({ phase: "spin", categories: [] }, { completed_at: "2026-10-08" }), questions), null);
  assert.equal(publicSession(null, questions), null);
});

test("the continue step comes back with the answer already shown", () => {
  const view = publicSession(
    row({
      phase: "continue",
      categories: ["Arsenal"],
      usedCells: [],
      answers: [{ questionId: "q1", correct: true, timedOut: false, pointsChange: 200 }],
      score: 200,
      answered: 1,
    }),
    questions,
    0,
  );
  assert.equal(view.result.next, "continuePrompt");
  assert.equal(view.result.answer, "SECRET ANSWER");
  assert.equal(view.streak, 1);
});
