import { REFLECTIONS_VOTING } from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";
import { buildModeStats } from "@/lib/account/guesser-stats";

export const BADGE_DEFS = [
  {
    slug: "founding_fan",
    check: ({ profile }) =>
      new Date(profile.created_at) <
      new Date(`${REFLECTIONS_VOTING.foundingCutoff}T00:00:00+04:00`),
    progress: () => null,
  },
  {
    slug: "the_purist",
    check: ({ plays }) =>
      plays.some((p) => {
        const clues = p.guesses?.revealedClues ?? [];
        return p.solved && clues.length === 0;
      }),
    progress: ({ plays }) => {
      const has = plays.some((p) => p.solved);
      return has ? null : { label: "Solve a board without using clues.", current: 0, target: 1 };
    },
  },
  {
    slug: "the_deducer",
    check: ({ plays }) =>
      plays.some((p) => p.solved && Number(p.attempts) <= 2),
    progress: ({ plays }) => {
      const close = plays.some((p) => p.solved && Number(p.attempts) === 3);
      if (close) return { label: "Solve in two guesses or fewer.", current: 1, target: 2 };
      return { label: "Solve in two guesses or fewer.", current: 0, target: 2 };
    },
  },
  {
    slug: "week_of_wins",
    check: ({ modeStats }) => {
      const wc = modeStats.find((m) => m.slug === "world_cup");
      return (wc?.bestStreak ?? 0) >= 7;
    },
    progress: ({ modeStats }) => {
      const wc = modeStats.find((m) => m.slug === "world_cup");
      const current = wc?.currentStreak ?? wc?.bestStreak ?? 0;
      if (current >= 7) return null;
      return {
        label: "Seven-day World Cup Legends win streak.",
        current,
        target: 7,
      };
    },
  },
  {
    slug: "month_of_wins",
    check: ({ modeStats }) => {
      const wc = modeStats.find((m) => m.slug === "world_cup");
      return (wc?.bestStreak ?? 0) >= 30;
    },
    progress: ({ modeStats }) => {
      const wc = modeStats.find((m) => m.slug === "world_cup");
      const current = wc?.bestStreak ?? 0;
      if (current >= 30) return null;
      return {
        label: "Thirty-day World Cup Legends win streak.",
        current,
        target: 30,
      };
    },
  },
  {
    slug: "full_ballot",
    check: ({ voteCount }) => voteCount >= 8,
    progress: ({ voteCount }) => ({
      label: "Vote in all eight Reflectives categories.",
      current: voteCount,
      target: 8,
    }),
  },
  {
    slug: "the_historian",
    check: ({ plays }) =>
      plays.filter((p) => p.mode === "world_cup" && p.solved).length >= 10,
    progress: ({ plays }) => {
      const current = plays.filter((p) => p.mode === "world_cup" && p.solved).length;
      if (current >= 10) return null;
      return {
        label: "Solve ten World Cup Legends puzzles.",
        current,
        target: 10,
      };
    },
  },
  {
    slug: "perfect_ten",
    check: ({ quizRows }) => quizRows.some((r) => r.correct === 10),
    progress: ({ quizRows }) => {
      if (quizRows.length === 0) return null;
      const best = quizRows.reduce((m, r) => Math.max(m, r.correct), 0);
      return { label: "Score 10 out of 10 in Are You Really a Fan?", current: best, target: 10 };
    },
  },
  {
    slug: "no_safety_net",
    check: ({ quizRows }) => quizRows.some((r) => r.answered === 10 && r.skipped === 0),
    progress: () => null,
  },
  {
    // Reveal state lives in the browser. The reveal flow awards this through awardBadge().
    slug: "every_league",
    check: () => false,
    progress: () => null,
  },
  {
    slug: "codebreaker",
    check: ({ codemaster }) => codemaster.hasRankedUp,
    progress: ({ codemaster }) => {
      if (codemaster.solved === 0 || !codemaster.rankedUpAt) return null;
      return {
        label: "Earn your first Codemaster title.",
        current: codemaster.solved,
        target: codemaster.rankedUpAt,
      };
    },
  },
];

async function syncUserBadges(userId, earnedSlugs) {
  const supabase = getServiceClient();
  if (!supabase) return;

  const { data: badges } = await supabase.from("badges").select("id, slug");
  if (!badges?.length) return;

  const slugToId = Object.fromEntries(badges.map((b) => [b.slug, b.id]));
  const rows = earnedSlugs
    .filter((slug) => slugToId[slug])
    .map((slug) => ({
      user_id: userId,
      badge_id: slugToId[slug],
    }));

  if (rows.length) {
    await supabase
      .from("user_badges")
      .upsert(rows, { onConflict: "user_id,badge_id", ignoreDuplicates: true });
  }
}

/** Award one badge by slug. Safe to repeat. Returns false when the badge row does not exist yet. */
export async function awardBadge(userId, slug) {
  const supabase = getServiceClient();
  if (!supabase) return false;
  const { data } = await supabase.from("badges").select("id").eq("slug", slug).maybeSingle();
  if (!data) return false;
  const { error } = await supabase
    .from("user_badges")
    .upsert({ user_id: userId, badge_id: data.id }, { onConflict: "user_id,badge_id", ignoreDuplicates: true });
  return !error;
}

export async function computeHonours(userId, context) {
  const supabase = getServiceClient();
  const earnedSlugs = BADGE_DEFS.filter((def) => def.check(context)).map(
    (d) => d.slug
  );

  await syncUserBadges(userId, earnedSlugs);

  let earned = [];
  if (supabase) {
    const { data } = await supabase
      .from("user_badges")
      .select("earned_at, badges (slug, name, description, sort_order)")
      .eq("user_id", userId)
      .order("earned_at", { ascending: true });
    earned = (data ?? [])
      .filter((row) => row.badges)
      .map((row) => ({
        slug: row.badges.slug,
        name: row.badges.name,
        description: row.badges.description,
        earnedAt: row.earned_at,
        sortOrder: row.badges.sort_order,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } else {
    earned = BADGE_DEFS.filter((d) => earnedSlugs.includes(d.slug)).map(
      (d) => ({
        slug: d.slug,
        name: d.slug.replace(/_/g, " "),
        description: "",
        earnedAt: new Date().toISOString(),
        sortOrder: 0,
      })
    );
  }

  const earnedSet = new Set(earned.map((b) => b.slug));
  const teaseCandidates = BADGE_DEFS.filter((d) => !earnedSet.has(d.slug))
    .map((d) => ({ slug: d.slug, progress: d.progress(context) }))
    .filter((t) => t.progress && t.progress.current < t.progress.target)
    .sort(
      (a, b) =>
        b.progress.current / b.progress.target -
        a.progress.current / a.progress.target
    );

  const nextTease = teaseCandidates[0] ?? null;

  return { earned, nextTease };
}

export async function loadPlaysForUser(userId) {
  const supabase = getServiceClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("plays")
    .select("mode, puzzle_date, solved, attempts, guesses")
    .eq("user_id", userId)
    .order("puzzle_date", { ascending: true });
  return data ?? [];
}

export async function countUserVotes(userId) {
  const supabase = getServiceClient();
  if (!supabase) return 0;
  const { data } = await supabase
    .from("votes")
    .select("category")
    .eq("user_id", userId);
  return new Set((data ?? []).map((v) => v.category)).size;
}

const NO_CODEMASTER = { solved: 0, hasRankedUp: false, rankedUpAt: null };

/**
 * `facts` carries rows already read from each game's own table:
 * { quizRows: fan_quiz_scores rows, codemaster: summariseCodemaster() }.
 */
export async function buildHonoursContext(userId, profile, facts = {}) {
  const plays = await loadPlaysForUser(userId);
  const modeStats = buildModeStats(plays);
  const voteCount = await countUserVotes(userId);
  return {
    profile,
    plays,
    modeStats,
    voteCount,
    quizRows: facts.quizRows ?? [],
    codemaster: facts.codemaster ?? NO_CODEMASTER,
  };
}
