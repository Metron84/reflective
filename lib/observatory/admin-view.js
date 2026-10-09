import "server-only";
import {
  AGE_BRACKETS,
  ARCHETYPES,
  ORDER,
  QUESTIONS,
  TED_LASSO,
  enumeratePaths,
} from "./footballer-001";

export function median(values) {
  const nums = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2) return nums[mid];
  return Math.round((nums[mid - 1] + nums[mid]) / 2);
}

export function studyDashboard(responses, answers) {
  const completed = responses.filter((row) => row.completed_at);
  const started = responses.length;
  const done = completed.length;
  const primary = Object.fromEntries(ORDER.map((key) => [key, 0]));
  for (const row of completed) {
    if (primary[row.primary_archetype] !== undefined) primary[row.primary_archetype] += 1;
  }

  const grid = Object.fromEntries(ORDER.map((key) => [key, Object.fromEntries(ORDER.map((col) => [col, 0]))]));
  let matched = 0;
  let perceived = 0;
  for (const row of completed) {
    if (!ORDER.includes(row.primary_archetype)) continue;
    if (!ORDER.includes(row.perception)) continue;
    perceived += 1;
    grid[row.primary_archetype][row.perception] += 1;
    if (row.perception === row.primary_archetype) matched += 1;
  }

  const gentle = Object.fromEntries(TED_LASSO.map((label) => [label, { gentle: 0, total: 0 }]));
  for (const row of completed) {
    if (!gentle[row.ted_lasso]) continue;
    gentle[row.ted_lasso].total += 1;
    if (row.primary_archetype === "G") gentle[row.ted_lasso].gentle += 1;
  }

  const byAge = Object.fromEntries(AGE_BRACKETS.map((label) => [label, Object.fromEntries(ORDER.map((key) => [key, 0]))]));
  for (const row of completed) {
    if (!byAge[row.age_bracket] || !ORDER.includes(row.primary_archetype)) continue;
    byAge[row.age_bracket][row.primary_archetype] += 1;
  }

  const byBranch = {};
  for (const row of completed) {
    const branch = row.branch || "none";
    if (!byBranch[branch]) byBranch[branch] = Object.fromEntries(ORDER.map((key) => [key, 0]));
    if (ORDER.includes(row.primary_archetype)) byBranch[branch][row.primary_archetype] += 1;
  }

  const positions = {};
  for (const answer of answers) {
    if (!positions[answer.question_id]) positions[answer.question_id] = { 1: 0, 2: 0, 3: 0 };
    const slot = positions[answer.question_id][answer.shown_position];
    if (slot !== undefined) positions[answer.question_id][answer.shown_position] += 1;
  }

  return {
    started,
    completed: done,
    completionRate: started ? done / started : 0,
    medianSeconds: median(completed.map((row) => Number(row.seconds_taken))),
    primary,
    grid,
    matchRate: perceived ? matched / perceived : 0,
    gentle,
    byAge,
    byBranch,
    positions,
    paths: enumeratePaths(),
    archetypes: ARCHETYPES,
    questions: QUESTIONS,
    order: ORDER,
  };
}

export function percent(count, total) {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}
