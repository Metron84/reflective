import { getUltimaDb } from "@/lib/ultima/server/db";

/** Names for receipt lines. Every lookup is best effort: a missing name just shortens the line. */
export async function teamNameOf(managerId) {
  const db = getUltimaDb();
  if (!db || !managerId) return null;
  const { data } = await db.from("ultima_managers").select("team_name").eq("id", managerId).maybeSingle();
  return data?.team_name ?? null;
}

export async function playerNameOf(playerId) {
  const db = getUltimaDb();
  if (!db || !playerId) return null;
  const { data } = await db.from("ultima_players").select("name").eq("id", playerId).maybeSingle();
  return data?.name ?? null;
}

/** The team on the other side of a trade from this manager. */
export async function otherTeamOfTrade(tradeId, managerId) {
  const db = getUltimaDb();
  if (!db || !tradeId) return null;
  const { data: trade } = await db
    .from("ultima_trades")
    .select("proposer_id, receiver_id")
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade) return null;
  return teamNameOf(trade.proposer_id === managerId ? trade.receiver_id : trade.proposer_id);
}
