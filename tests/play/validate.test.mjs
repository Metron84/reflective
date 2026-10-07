import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateQuestions } from "@/lib/play/validate.js";

const base = {
  id: "t-100-c1", category: "T", value: 100, clue: "A clue.", answer: "Foo",
  matchMode: "fuzzy", tags: ["a"], check: "record", source: "s", acceptedAnswers: ["foo"],
};
const cell = (value, n) => Array.from({ length: n }, (_, i) => ({ ...base, id: `t-${value}-c${i}`, value }));
const fullSet = () => [100, 200, 300, 400, 500].flatMap((v) => cell(v, 3));
const errors = (d) => validateQuestions(d).filter((i) => i.level === "error").map((i) => i.message);

test("passes a clean set", () => assert.deepEqual(errors(fullSet()), []));

test("flags duplicate ids", () => {
  const d = fullSet();
  d[1] = { ...d[1], id: d[0].id };
  assert.ok(errors(d).includes("duplicate id"));
});

test("errors on an empty cell and warns on a thin one", () => {
  assert.ok(errors(fullSet().filter((q) => q.value !== 300)).includes("cell has 0 variants"));
  const thin = fullSet().filter((q) => q.id !== "t-100-c2");
  assert.ok(validateQuestions(thin).some((i) => i.level === "warn"));
});

test("flags an answer equal to the category or inside its clue", () => {
  let d = fullSet();
  d[0] = { ...d[0], acceptedAnswers: ["T"] };
  assert.ok(errors(d).some((m) => m.startsWith("accepted answer equals category")));
  d = fullSet();
  d[0] = { ...d[0], clue: "This is about foo today." };
  assert.ok(errors(d).some((m) => m.startsWith("accepted answer appears in clue")));
});

test("flags missing fields, unknown matchMode and em-dashes", () => {
  const d = fullSet();
  d[0] = { ...d[0], source: "", matchMode: "loose", clue: "A clue — here." };
  const e = errors(d);
  assert.ok(e.includes("missing field: source"));
  assert.ok(e.includes("unknown matchMode: loose"));
  assert.ok(e.includes("em-dash in clue"));
});

test("passes the real question set", () => {
  const real = JSON.parse(readFileSync(join(process.cwd(), "data", "play", "questions.json"), "utf8"));
  assert.deepEqual(errors(real), []);
});
