import {
  REFLECTIONS_CATEGORIES,
  getOpenCategories,
  getVotingState,
} from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";
import { getNomineesByCategory } from "@/lib/reflections";

export async function getMemberBallot(userId) {
  const supabase = getServiceClient();
  const nomineesByCategory = await getNomineesByCategory();
  const votingState = getVotingState();
  const openCategories = getOpenCategories();

  let userVotes = [];
  if (supabase && userId) {
    const { data } = await supabase
      .from("votes")
      .select("category, nominee_id")
      .eq("user_id", userId);
    userVotes = data ?? [];
  }

  const pickByCategory = Object.fromEntries(
    userVotes.map((v) => [v.category, v.nominee_id])
  );

  const votedSlugs = Object.keys(pickByCategory);

  let standingsByCategory = {};
  if (supabase && votedSlugs.length) {
    const { data: tally } = await supabase
      .from("reflections_tally_authenticated")
      .select("category, nominee_id, title, votes")
      .in("category", votedSlugs);
    for (const row of tally ?? []) {
      (standingsByCategory[row.category] ??= []).push(row);
    }
    for (const slug of Object.keys(standingsByCategory)) {
      standingsByCategory[slug].sort((a, b) => b.votes - a.votes);
    }
  }

  const categories = REFLECTIONS_CATEGORIES.map((cat) => {
    const nomineeId = pickByCategory[cat.slug] ?? null;
    const nominees = nomineesByCategory[cat.slug] ?? [];
    const pick = nominees.find((n) => n.id === nomineeId) ?? null;
    // Standings only for categories this member has voted in.
    const standings = pick
      ? (standingsByCategory[cat.slug] ?? []).slice(0, 8)
      : [];

    return {
      slug: cat.slug,
      name: cat.name,
      open: cat.open,
      pick: pick ? { id: pick.id, title: pick.title } : null,
      standings,
    };
  });

  const votedOpenCount = openCategories.filter((c) =>
    pickByCategory[c.slug]
  ).length;

  return {
    categories,
    votedCount: votedOpenCount,
    total: openCategories.length,
    totalCategories: REFLECTIONS_CATEGORIES.length,
    votingState,
    ballotNote:
      votingState === "closed"
        ? `You voted in ${votedOpenCount} of ${openCategories.length} categories.`
        : "After each vote, that category's race opens for you.",
  };
}
