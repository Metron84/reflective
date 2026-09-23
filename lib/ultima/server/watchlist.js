import { ULTIMA_DEFAULT_RATING_THRESHOLDS } from "@/lib/ultima/constants";
import { isFinishedStatus } from "@/lib/ultima/fixture-status";
import { fixtureBasePoints } from "@/lib/ultima/scoring";
import { getUltimaDb } from "@/lib/ultima/server/db";

export async function getWatchlistIds(managerId) {
  const db = getUltimaDb();
  if (!db || !managerId) return [];
  const { data, error } = await db
    .from("ultima_watchlist")
    .select("player_id")
    .eq("manager_id", managerId);
  if (error) return [];
  return (data ?? []).map((row) => row.player_id).filter(Boolean);
}

export async function setWatchlist({ managerId, playerId, on }) {
  const db = getUltimaDb();
  if (!db || !managerId || !playerId) return { ok: false, code: "UNAVAILABLE" };

  if (on) {
    const { error } = await db.from("ultima_watchlist").upsert(
      { manager_id: managerId, player_id: playerId },
      { onConflict: "manager_id,player_id" },
    );
    if (error) return { ok: false, code: "UNAVAILABLE" };
    return { ok: true };
  }

  const { error } = await db
    .from("ultima_watchlist")
    .delete()
    .eq("manager_id", managerId)
    .eq("player_id", playerId);
  if (error) return { ok: false, code: "UNAVAILABLE" };
  return { ok: true };
}

function hasBothScores(fixture) {
  return fixture?.home_score != null && fixture?.away_score != null;
}

/**
 * Scout inbox lines for watched players whose last confirmed match
 * scored real Ultima points. Missing stats stay off the list.
 */
export async function listWatchlistScoutReports(managerId) {
  const db = getUltimaDb();
  const ids = await getWatchlistIds(managerId);
  if (!db || !ids.length) return [];

  const { data } = await db
    .from("ultima_player_match_stats")
    .select(
      "player_id, goals, assists, rating, ultima_players(name, league, club), ultima_fixtures(kickoff, kickoff_at, status, home_club, away_club, home_score, away_score)",
    )
    .in("player_id", ids)
    .order("updated_at", { ascending: false })
    .limit(120);

  const seen = new Set();
  const reports = [];
  for (const row of data ?? []) {
    if (seen.has(row.player_id)) continue;
    const fixture = row.ultima_fixtures;
    if (!fixture || !isFinishedStatus(fixture.status) || !hasBothScores(fixture)) {
      continue;
    }
    const league = row.ultima_players?.league ?? "pl";
    const points = fixtureBasePoints(row, ULTIMA_DEFAULT_RATING_THRESHOLDS[league] ?? ULTIMA_DEFAULT_RATING_THRESHOLDS.pl);
    if (!(points > 0)) continue;
    seen.add(row.player_id);

    const goals = Number(row.goals ?? 0);
    const assists = Number(row.assists ?? 0);
    const rating = row.rating == null ? null : Number(row.rating);
    const bits = [];
    if (goals) bits.push(`${goals}G`);
    if (assists) bits.push(`${assists}A`);
    if (Number.isFinite(rating)) bits.push(rating.toFixed(2));
    if (!bits.length) continue;

    reports.push({
      id: `scout-${row.player_id}`,
      subject: `${row.ultima_players?.name ?? "A watched player"} ${bits.join(" ")}`,
      at: fixture.kickoff_at ?? fixture.kickoff,
    });
  }
  return reports;
}
