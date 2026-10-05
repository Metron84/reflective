import { getUltimaDb } from "@/lib/ultima/server/db";
import { getManagerRoster } from "@/lib/ultima/server/lineup";
import { canAddUntouchable } from "@/lib/ultima/trades/rules";
import { getReadDb } from "@/lib/ultima/server/strict-db";

/** { [managerId]: [playerId] } for every manager in the competition. */
export async function listUntouchables(competitionId) {
  const db = getReadDb();
  if (!db || !competitionId) return {};
  const { data: managers } = await db
    .from("ultima_managers")
    .select("id")
    .eq("competition_id", competitionId);
  const ids = (managers ?? []).map((m) => m.id);
  if (!ids.length) return {};
  const { data, error } = await db
    .from("ultima_untouchables")
    .select("manager_id, player_id")
    .in("manager_id", ids);
  if (error) return {};
  const map = {};
  for (const row of data ?? []) {
    (map[row.manager_id] ??= []).push(row.player_id);
  }
  return map;
}

export async function listManagerUntouchables(managerId) {
  const db = getReadDb();
  if (!db || !managerId) return [];
  const { data, error } = await db
    .from("ultima_untouchables")
    .select("player_id")
    .eq("manager_id", managerId);
  if (error) return [];
  return (data ?? []).map((row) => row.player_id);
}

/** Mark or unmark one of the manager's own players. Marking clears a block listing. */
export async function setUntouchable({ managerId, playerId, on }) {
  const db = getUltimaDb();
  if (!db || !managerId || !playerId) return { ok: false, code: "UNAVAILABLE" };

  if (!on) {
    const { error } = await db
      .from("ultima_untouchables")
      .delete()
      .eq("manager_id", managerId)
      .eq("player_id", playerId);
    if (error) return { ok: false, code: "UNAVAILABLE" };
    return { ok: true, untouchable: false };
  }

  const roster = await getManagerRoster(managerId);
  if (!roster.some((p) => p.id === playerId)) {
    return { ok: false, code: "INVALID", message: "That player is not on your squad." };
  }

  const current = await listManagerUntouchables(managerId);
  const gate = canAddUntouchable(current, playerId);
  if (!gate.ok) return { ok: false, code: gate.code };
  if (gate.already) return { ok: true, untouchable: true };

  const { error } = await db
    .from("ultima_untouchables")
    .insert({ manager_id: managerId, player_id: playerId });
  if (error) {
    return /untouchable_limit/.test(error.message ?? "")
      ? { ok: false, code: "UNTOUCHABLE_LIMIT" }
      : { ok: false, code: "UNAVAILABLE" };
  }

  // An untouchable player is not for sale.
  await db.from("ultima_trade_block").delete().eq("manager_id", managerId).eq("player_id", playerId);
  return { ok: true, untouchable: true, cleared_block: true };
}
