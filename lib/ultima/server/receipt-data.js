import { getLoggedDb } from "@/lib/ultima/server/strict-db";

/** A player's name for a receipt line. null when it cannot be read. */
export async function playerNameFor(playerId) {
  const db = getLoggedDb("receipt-data");
  if (!db || !playerId) return null;
  const { data } = await db.from("ultima_players").select("name").eq("id", playerId).maybeSingle();
  return data?.name ?? null;
}

/** A club's team name for a receipt line. null when it cannot be read. */
export async function teamNameFor(managerId) {
  const db = getLoggedDb("receipt-data");
  if (!db || !managerId) return null;
  const { data } = await db.from("ultima_managers").select("team_name").eq("id", managerId).maybeSingle();
  return data?.team_name ?? null;
}
