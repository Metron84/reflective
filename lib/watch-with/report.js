import "server-only";
import { presentClub } from "./access";
import { publicCard } from "./clubs";
import { COUNTING_VOTES } from "./engine";
import { db } from "./store";

function rankMap(rows, score) {
  const ranked = rows
    .filter((row) => row.votes >= COUNTING_VOTES)
    .sort(score);
  return new Map(ranked.map((row, index) => [row.id, index + 1]));
}

function topThree(map, names) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id, count]) => ({ name: names.get(id) || id, count }));
}

export async function clubReport(slug) {
  const club = await presentClub(slug);
  if (!club) return null;
  const client = db();
  const empty = { fans: 0, verified: 0, runs: 0, picks: 0 };
  if (!client) return { club, rows: [], totals: empty, offline: true };

  const { data: ratings, error } = await client
    .from("watch_with_ratings")
    .select("card_id, segment, elo, votes, wins")
    .eq("club_slug", slug);
  if (error) throw error;

  const { data: verified, error: verifiedError } = await client
    .from("watch_with_verified_results")
    .select("card_id, wins, votes, win_rate")
    .eq("club_slug", slug);
  if (verifiedError) throw verifiedError;

  const { data: swipes, error: swipeError } = await client
    .from("watch_with_swipes")
    .select("winner_id, loser_id")
    .eq("club_slug", slug);
  if (swipeError) throw swipeError;

  const { count: runs, error: runError } = await client
    .from("watch_with_runs")
    .select("id", { count: "exact", head: true })
    .eq("club_slug", slug)
    .not("completed_at", "is", null);
  if (runError) throw runError;

  const { data: linked, error: linkedError } = await client
    .from("watch_with_runs")
    .select("fan_id")
    .eq("club_slug", slug)
    .not("fan_id", "is", null)
    .not("completed_at", "is", null);
  if (linkedError) throw linkedError;

  const fanIds = [...new Set((linked ?? []).map((row) => row.fan_id).filter(Boolean))];
  let verifiedFans = 0;
  if (fanIds.length) {
    const { data: fans, error: fanError } = await client
      .from("watch_with_fans")
      .select("id, email_verified")
      .in("id", fanIds);
    if (fanError) throw fanError;
    verifiedFans = (fans ?? []).filter((row) => row.email_verified).length;
  }

  const names = new Map((club.cards ?? []).map((card) => [card.id, card.name]));
  const beats = {};
  const loses = {};
  for (const swipe of swipes ?? []) {
    beats[swipe.winner_id] ??= {};
    beats[swipe.winner_id][swipe.loser_id] = (beats[swipe.winner_id][swipe.loser_id] ?? 0) + 1;
    loses[swipe.loser_id] ??= {};
    loses[swipe.loser_id][swipe.winner_id] = (loses[swipe.loser_id][swipe.winner_id] ?? 0) + 1;
  }

  const bySegment = (segment) => {
    const map = new Map();
    for (const row of ratings ?? []) {
      if (row.segment === segment) map.set(row.card_id, row);
    }
    return map;
  };
  const fanRatings = bySegment("fan");
  const allRatings = bySegment("all");
  const verifiedMap = new Map((verified ?? []).map((row) => [row.card_id, row]));

  const fanRows = [];
  const allRows = [];
  const verifiedRows = [];
  const cards = (club.cards ?? []).filter((card) => card.active || fanRatings.has(card.id) || allRatings.has(card.id));
  for (const card of cards) {
    const fan = fanRatings.get(card.id);
    const everyone = allRatings.get(card.id);
    const seen = verifiedMap.get(card.id);
    fanRows.push({ id: card.id, votes: fan ? Number(fan.votes) : 0, elo: fan ? Number(fan.elo) : 0 });
    allRows.push({ id: card.id, votes: everyone ? Number(everyone.votes) : 0, elo: everyone ? Number(everyone.elo) : 0 });
    verifiedRows.push({
      id: card.id,
      votes: seen ? Number(seen.votes) : 0,
      winRate: seen ? Number(seen.win_rate) : 0,
    });
  }
  const fanRank = rankMap(fanRows, (a, b) => b.elo - a.elo);
  const allRank = rankMap(allRows, (a, b) => b.elo - a.elo);
  const verifiedRank = rankMap(verifiedRows, (a, b) => b.winRate - a.winRate);

  const rows = cards.map((card) => {
    const fan = fanRatings.get(card.id);
    const votes = fan ? Number(fan.votes) : 0;
    const wins = fan ? Number(fan.wins) : 0;
    return {
      ...publicCard(card),
      fanRank: fanRank.get(card.id) ?? null,
      allRank: allRank.get(card.id) ?? null,
      verifiedRank: verifiedRank.get(card.id) ?? null,
      votes,
      wins,
      winRate: votes ? wins / votes : 0,
      elo: fan ? Number(fan.elo) : 0,
      beats: topThree(beats[card.id], names),
      loses: topThree(loses[card.id], names),
    };
  });

  return {
    club,
    rows,
    totals: {
      fans: fanIds.length,
      verified: verifiedFans,
      runs: runs ?? 0,
      picks: (swipes ?? []).length,
    },
    offline: false,
  };
}

export async function marketingFans(slug) {
  const client = db();
  if (!client) return [];
  const { data: linked, error } = await client
    .from("watch_with_runs")
    .select("fan_id")
    .eq("club_slug", slug)
    .not("fan_id", "is", null);
  if (error) throw error;
  const ids = [...new Set((linked ?? []).map((row) => row.fan_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error: fanError } = await client
    .from("watch_with_fans")
    .select("email, first_name, location, supporters_club, consent_save_result, consent_marketing, created_at")
    .in("id", ids)
    .eq("consent_marketing", true);
  if (fanError) throw fanError;
  return data ?? [];
}
