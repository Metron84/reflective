import assert from "node:assert/strict";
import test from "node:test";
import {
  enumeratePaths,
  expectedQuestionId,
  publicQuestion,
  rankArchetypes,
  scoreAnswers,
} from "../../lib/observatory/footballer-001.js";
import { isObservatoryHost, observatoryHostAction } from "../../lib/observatory/host.js";

test("a tension answer counts double and public questions hide points", () => {
  const answers = [{ questionId: "tW", optionId: "tW_a" }];
  const scored = scoreAnswers(answers);
  assert.equal(scored.scores.W, 4);
  assert.equal(scored.tensionPoints.W, 4);
  const shown = publicQuestion("q1", 1);
  assert.equal(JSON.stringify(shown).includes("points"), false);
  assert.equal(JSON.stringify(shown).includes("go"), false);
  assert.equal(shown.total, 10);
});

test("the path follows the branch and the leading archetype", () => {
  const answers = [
    { questionId: "q1", optionId: "q1_win" },
    { questionId: "win1", optionId: "win1_a" },
  ];
  assert.equal(expectedQuestionId([]), "q1");
  assert.equal(expectedQuestionId(answers.slice(0, 1)), "win1");
  assert.equal(expectedQuestionId(answers), "win2");
  assert.equal(rankArchetypes([{ questionId: "core1", optionId: "core1_a" }])[0], "W");
});

test("every combination of the six questions is counted", () => {
  const paths = enumeratePaths();
  assert.equal(paths.total, 729);
  const leaders = Object.values(paths.leaderCounts).reduce((sum, count) => sum + count, 0);
  assert.equal(leaders, 729);
});

test("the observatory host rewrites the short urls and leaves the api alone", () => {
  assert.equal(isObservatoryHost("observatory.thereflectivefootball.com"), true);
  assert.equal(isObservatoryHost("observatory.localhost:4343"), true);
  assert.equal(isObservatoryHost("www.thereflectivefootball.com"), false);
  assert.deepEqual(observatoryHostAction("/"), { type: "rewrite", to: "/observatory" });
  assert.deepEqual(observatoryHostAction("/footballer-001"), { type: "rewrite", to: "/observatory/footballer-001" });
  assert.deepEqual(observatoryHostAction("/api/observatory/footballer-001/answer"), { type: "pass" });
  assert.deepEqual(observatoryHostAction("/observatory"), { type: "redirect", to: "/", keepSearch: true });
});
