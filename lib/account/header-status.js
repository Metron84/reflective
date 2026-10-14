import { formatMemberNumber } from "@/lib/auth/config";
import { pickNextUp } from "@/lib/account/next-up";
import { getCrestLeagues } from "@/lib/account/crest-leagues";
import { getRevealed } from "@/lib/account/crest-reveals";
import { dubaiDay } from "@/lib/play/week.js";
import { getServiceClient } from "@/lib/supabase";
import { getRenderClient } from "@/lib/supabase/server";

/** Up to two letters: the first letters of the first two words of the name. */
export function initialsOf(name) {
  const words = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "?";
  return words
    .slice(0, 2)
    .map((w) => Array.from(w)[0])
    .join("")
    .toUpperCase();
}

/**
 * Is something waiting on My Programme? Uses the same Next up rules as the page: a dot shows
 * whenever Next up would pick anything other than the "Spin the wheel" fallback.
 */
export function headerPending(inputs) {
  return pickNextUp(inputs).key !== "fallback";
}

async function codemasterInProgress(supabase, userId) {
  const { count } = await supabase
    .from("codemaster_solves")
    .select("puzzle_id", { count: "exact", head: true })
    .eq("user_id", userId);
  const solved = count ?? 0;
  if (solved === 0) return false;
  // The puzzle total sits in a large JSON file, so only load it for members who have started.
  const { default: codemaster } = await import("@/public/codemaster/codemaster.json");
  return solved < codemaster.totalPuzzles;
}

async function quizOpenToday(supabase, userId) {
  const { count } = await supabase
    .from("fan_quiz_scores")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("counted", true)
    .eq("play_day", dubaiDay());
  return (count ?? 0) === 0;
}

async function unrevealedLeagues(userId) {
  const render = await getRenderClient();
  const crest = await getCrestLeagues(render, userId);
  if (!crest) return 0;
  const revealed = await getRevealed(render, userId, crest);
  return crest.leagues.filter((l) => !revealed.includes(l.competition)).length;
}

/**
 * What the header needs for a signed-in member. Server only, no client fetch.
 * Any failure leaves the dot off: the header must never break a page.
 */
export async function loadHeaderProgramme(user, profile) {
  const base = {
    initials: initialsOf(profile?.preferred_name),
    memberNumber: formatMemberNumber(profile?.member_number),
    pending: false,
  };
  try {
    const supabase = getServiceClient();
    if (!supabase || !user?.id) return base;
    const [quizOpen, unrevealed, inProgress] = await Promise.all([
      quizOpenToday(supabase, user.id),
      unrevealedLeagues(user.id),
      codemasterInProgress(supabase, user.id),
    ]);
    return { ...base, pending: headerPending({ quizOpen, unrevealed, codemasterInProgress: inProgress }) };
  } catch {
    return base;
  }
}
