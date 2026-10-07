import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateQuestions } from "../lib/play/validate.js";

const file = join(process.cwd(), "data", "play", "questions.json");
const data = JSON.parse(readFileSync(file, "utf8"));
const issues = validateQuestions(data);
const errors = issues.filter((i) => i.level === "error");
const warns = issues.filter((i) => i.level === "warn");

for (const i of issues) console.log(`${i.level.toUpperCase()} ${i.id}: ${i.message}`);
console.log(`${Array.isArray(data) ? data.length : 0} play questions, ${errors.length} errors, ${warns.length} warnings`);
process.exit(errors.length ? 1 : 0);
