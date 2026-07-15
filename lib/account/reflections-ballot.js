import {
  REFLECTIONS_CATEGORIES,
  REFLECTIONS_VOTING,
  getOpenCategories,
  getVotingState,
  reflectionsWinnersHeroLine,
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

  let standingsByCategory = {};
  if (supabase) {
    const { data: tally } = await supabase
      .from("reflections_tally_authenticated")
      .select("category, nominee_id, title, votes");
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
    const standings = (standingsByCategory[cat.slug] ?? []).slice(0, 4);

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
    winnersDay: reflectionsWinnersHeroLine(),
    winnersAnnounced: REFLECTIONS_VOTING.winnersAnnounced,
    preResultsCopy: reflectionsWinnersHeroLine(),
  };
}
