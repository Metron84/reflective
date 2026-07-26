/**
 * Fan Card pure helpers for The Stand.
 * Reads trf_stand_v1 progress as-is. No React. No localStorage writes.
 */

import titles from "../../data/stand/titles.json" with { type: "json" };

const BADGES = ["club", "nation", "player"];

/**
 * @param {Array<{ tags?: string[] } | string[]>} answers
 *   Chosen choices for one badge lane (objects with tags, or raw tag arrays).
 * @returns {{ tag: string, count: number }[]}
 */
export function computeDominantTags(answers) {
  const counts = new Map();
  for (const entry of answers || []) {
    const tags = Array.isArray(entry)
      ? entry
      : Array.isArray(entry?.tags)
        ? entry.tags
        : [];
    for (const tag of tags) {
      if (!tag || tag === "chapter_end") continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

function scoreTitle(title, dominantTags) {
  if (!title?.tags?.length) return 0;
  const countByTag = new Map(dominantTags.map((d) => [d.tag, d.count]));
  let score = 0;
  for (const tag of title.tags) {
    const c = countByTag.get(tag) || 0;
    if (c > 0) score += c;
  }
  // Prefer titles whose full tag set is represented
  const covered = title.tags.filter((t) => (countByTag.get(t) || 0) > 0).length;
  score += covered * 0.1;
  return score;
}

function fallbackTitle(badge) {
  const scope = BADGES.includes(badge) ? badge : "club";
  const found = titles.find((t) => t.badge_scope === scope && t.fallback);
  if (found) return found;
  return (
    titles.find((t) => t.badge_scope === scope) || {
      id: `${scope}-fallback`,
      label: "Of This Stand",
      badge_scope: scope,
      tags: [],
      fallback: true,
    }
  );
}

/**
 * @param {{ tag: string, count: number }[]} dominantTags
 * @param {"club"|"nation"|"player"|string} badge
 * @returns {object} title object (never null)
 */
export function resolveTitle(dominantTags, badge) {
  const scope = BADGES.includes(badge) ? badge : "club";
  const candidates = titles.filter(
    (t) =>
      !t.fallback &&
      (t.badge_scope === scope || t.badge_scope === "any"),
  );

  let best = null;
  let bestScore = 0;
  for (const title of candidates) {
    const score = scoreTitle(title, dominantTags || []);
    if (score > bestScore) {
      bestScore = score;
      best = title;
    }
  }

  if (best && bestScore > 0) return best;
  return fallbackTitle(scope);
}

function completedDaysFromProgress(progress) {
  const answered = Object.keys(progress?.answers || {})
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!answered.length) return [];
  const maxOrder = Math.max(...answered);
  const days = [];
  if (maxOrder >= 5) days.push(1);
  if (maxOrder >= 10) days.push(2);
  if (maxOrder >= 15) days.push(3);
  return days;
}

function resolveChosenChoices(progress, getChapter) {
  const chapter =
    typeof getChapter === "function"
      ? getChapter(progress?.chapterId)
      : null;
  if (!chapter?.questions || !progress?.answers) return [];

  const chosen = [];
  for (const [orderKey, choiceId] of Object.entries(progress.answers)) {
    const order = Number(orderKey);
    const question = chapter.questions.find((q) => q.order === order);
    if (!question) continue;
    const choice = question.choices?.find((c) => c.id === choiceId);
    if (!choice) continue;
    chosen.push({
      order,
      choiceId,
      label: choice.label,
      tags: [...(choice.tags || [])],
      prompt: question.prompt,
      day: question.day,
    });
  }
  return chosen.sort((a, b) => a.order - b.order);
}

/**
 * Prefer minority-tagged choices among those already taken.
 * @param {Array<{ tags: string[], order: number }>} chosen
 * @param {number} limit
 */
function pickDeclarations(chosen, limit = 3) {
  if (!chosen.length) return [];
  const dominant = computeDominantTags(chosen);
  const countByTag = new Map(dominant.map((d) => [d.tag, d.count]));

  const rarity = (choice) => {
    const tags = (choice.tags || []).filter((t) => t !== "chapter_end");
    if (!tags.length) return Number.POSITIVE_INFINITY;
    return Math.min(...tags.map((t) => countByTag.get(t) || 0));
  };

  return [...chosen]
    .sort((a, b) => rarity(a) - rarity(b) || a.order - b.order)
    .slice(0, limit)
    .map(({ order, choiceId, label, tags, prompt }) => ({
      order,
      choiceId,
      label,
      tags,
      prompt,
    }));
}

/**
 * Build Fan Card state from trf_stand_v1 progress.
 * Does not mutate progress or localStorage.
 *
 * @param {object} progress - existing Stand localStorage shape
 * @param {(chapterId: string) => object | null} [getChapter]
 *   Optional chapter loader so this module stays free of fs/React.
 *   Without it, titles fall back and declarations stay empty.
 */
export function buildCardState(progress = {}, getChapter) {
  const badges = {
    clubId: progress.badges?.clubId ?? null,
    nationId: progress.badges?.nationId ?? null,
    personId: progress.badges?.personId ?? null,
  };
  const activeBadge = BADGES.includes(progress.activeBadge)
    ? progress.activeBadge
    : "club";

  const stamps = { club: [], nation: [], player: [] };
  const completedDays = completedDaysFromProgress(progress);
  if (completedDays.length) {
    stamps[activeBadge] = [...completedDays];
  }

  const chosen = resolveChosenChoices(progress, getChapter);
  const dominantTags = computeDominantTags(chosen);

  const titlesOut = {
    club: fallbackTitle("club"),
    nation: fallbackTitle("nation"),
    player: fallbackTitle("player"),
  };
  if (chosen.length) {
    titlesOut[activeBadge] = resolveTitle(dominantTags, activeBadge);
  }

  return {
    badges,
    activeBadge,
    stamps,
    titles: titlesOut,
    declarations: pickDeclarations(chosen, 3),
    claimed: false,
  };
}

export function getStandTitles() {
  return titles;
}
