import { normalize } from "./match.js";
import { CELL_VALUES, MATCH_MODES } from "./questions.js";

const REQUIRED = ["id", "category", "value", "clue", "answer", "matchMode", "tags", "check", "source"];

function containsPhrase(text, phrase) {
  return !!phrase && ` ${text} `.includes(` ${phrase} `);
}

/** Returns [{ level: "error" | "warn", id, message }]. */
export function validateQuestions(data) {
  const issues = [];
  const err = (id, message) => issues.push({ level: "error", id, message });
  const warn = (id, message) => issues.push({ level: "warn", id, message });

  if (!Array.isArray(data)) {
    err("-", "questions file must be an array");
    return issues;
  }

  const seen = new Set();
  const cells = new Map();
  const categories = new Set();

  for (const [i, q] of data.entries()) {
    const id = typeof q?.id === "string" ? q.id : `#${i}`;
    for (const f of REQUIRED) {
      if (q?.[f] === undefined || q?.[f] === null || q?.[f] === "") err(id, `missing field: ${f}`);
    }
    if (typeof q?.id === "string") {
      if (seen.has(q.id)) err(id, "duplicate id");
      seen.add(q.id);
    }
    if (q?.matchMode && !MATCH_MODES.includes(q.matchMode)) err(id, `unknown matchMode: ${q.matchMode}`);

    const hasAccepted = Array.isArray(q?.acceptedAnswers) && q.acceptedAnswers.length > 0;
    const hasGroups = Array.isArray(q?.answerGroups) && q.answerGroups.length > 0;
    if (!hasAccepted && !hasGroups) err(id, "needs acceptedAnswers or answerGroups");
    if (hasGroups) {
      const n = q.requiredCount;
      if (!Number.isInteger(n) || n < 1 || n > q.answerGroups.length) err(id, "answerGroups needs a valid requiredCount");
    }

    if (typeof q?.clue === "string" && q.clue.includes("—")) err(id, "em-dash in clue");

    const category = typeof q?.category === "string" ? q.category : "";
    const accepted = [...(hasAccepted ? q.acceptedAnswers : []), ...(hasGroups ? q.answerGroups.flat() : [])];
    const clue = typeof q?.clue === "string" ? normalize(q.clue) : "";
    for (const a of accepted) {
      const n = normalize(String(a));
      if (n && n === normalize(category)) err(id, `accepted answer equals category name: "${a}"`);
      if (containsPhrase(clue, n)) err(id, `accepted answer appears in clue: "${a}"`);
    }

    if (category) {
      categories.add(category);
      const key = `${category}|${q.value}`;
      cells.set(key, (cells.get(key) ?? 0) + 1);
    }
  }

  for (const c of categories) {
    for (const v of CELL_VALUES) {
      const n = cells.get(`${c}|${v}`) ?? 0;
      if (n === 0) err(`${c} ${v}`, "cell has 0 variants");
      else if (n < 3) warn(`${c} ${v}`, `cell has ${n} variants (want 3 or more)`);
    }
  }
  return issues;
}
