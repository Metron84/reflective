import { ULTIMA_SQUAD_SIZE, ULTIMA_SQUAD_FLOOR_PER_LEAGUE, ULTIMA_LEAGUES, leagueLabel } from "@/lib/ultima/constants";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { getManagerRoster, isLeagueLocked, squadLeagueCounts } from "@/lib/ultima/server/lineup";
import { markBoltEligible } from "@/lib/ultima/server/players";

export async function addDropTransaction({
  managerId,
  addPlayerId,
  dropPlayerId,
  gameweekId,
  gameweek,
}) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const roster = await getManagerRoster(managerId);
  if (roster.length >= ULTIMA_SQUAD_SIZE && !dropPlayerId) {
    return { ok: false, code: "SQUAD_FULL" };
  }

  const dropPlayer = roster.find((p) => p.id === dropPlayerId);
  if (dropPlayerId && !dropPlayer) {
    return { ok: false, code: "FLOOR_VIOLATION", message: "That player is not on your squad." };
  }

  if (dropPlayer && gameweek && isLeagueLocked(gameweek, dropPlayer.league)) {
    return { ok: false, code: "LEAGUE_LOCKED" };
  }

  const { data: addPlayer } = await db
    .from("ultima_players")
    .select("*")
    .eq("id", addPlayerId)
    .maybeSingle();

  if (!addPlayer) {
    return { ok: false, code: "UNAVAILABLE", message: "That player is not available." };
  }

  const { data: onRoster } = await db
    .from("ultima_rosters")
    .select("manager_id")
    .eq("player_id", addPlayerId)
    .maybeSingle();

  if (onRoster) {
    return { ok: false, code: "PICK_TAKEN", message: "Someone else has him." };
  }

  // Simulate post-drop counts
  const counts = squadLeagueCounts(roster.filter((p) => p.id !== dropPlayerId));
  counts[addPlayer.league] = (counts[addPlayer.league] ?? 0) + 1;

  for (const league of ULTIMA_LEAGUES) {
    if (counts[league] < ULTIMA_SQUAD_FLOOR_PER_LEAGUE) {
      return {
        ok: false,
        code: "FLOOR_VIOLATION",
        message: `That move breaks the ${leagueLabel(league)} floor.`,
      };
    }
  }

  if (dropPlayerId) {
    await db.from("ultima_rosters").delete().eq("manager_id", managerId).eq("player_id", dropPlayerId);
    await db.from("ultima_transactions").insert({
      manager_id: managerId,
      type: "drop",
      player_id: dropPlayerId,
      gameweek_id: gameweekId,
    });
  }

  await db.from("ultima_rosters").insert({
    manager_id: managerId,
    player_id: addPlayerId,
  });

  await db
    .from("ultima_players")
    .update({
      draft_round: null,
      bolt_eligible: true,
    })
    .eq("id", addPlayerId);

  await db.from("ultima_transactions").insert({
    manager_id: managerId,
    type: "add",
    player_id: addPlayerId,
    related_player_id: dropPlayerId,
    gameweek_id: gameweekId,
  });

  await db.from("ultima_events").insert({
    event: "market_add",
    manager_id: managerId,
    payload: { add: addPlayerId, drop: dropPlayerId },
  });

  publishUltimaEvent("market.transaction", {
    manager_id: managerId,
    added: addPlayer,
    dropped: dropPlayer ?? null,
  });

  return { ok: true };
}

export async function dropPlayer({ managerId, playerId, gameweekId, gameweek }) {
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const roster = await getManagerRoster(managerId);
  const dropPlayerRow = roster.find((p) => p.id === playerId);
  if (!dropPlayerRow) {
    return { ok: false, code: "FLOOR_VIOLATION", message: "That player is not on your squad." };
  }

  if (gameweek && isLeagueLocked(gameweek, dropPlayerRow.league)) {
    return { ok: false, code: "LEAGUE_LOCKED" };
  }

  const counts = squadLeagueCounts(roster.filter((p) => p.id !== playerId));
  for (const league of ULTIMA_LEAGUES) {
    if (counts[league] < ULTIMA_SQUAD_FLOOR_PER_LEAGUE) {
      return { ok: false, code: "FLOOR_VIOLATION", message: "That drop breaks a league floor." };
    }
  }

  await db.from("ultima_rosters").delete().eq("manager_id", managerId).eq("player_id", playerId);
  await db.from("ultima_transactions").insert({
    manager_id: managerId,
    type: "drop",
    player_id: playerId,
    gameweek_id: gameweekId,
  });

  publishUltimaEvent("market.transaction", {
    manager_id: managerId,
    added: null,
    dropped: dropPlayerRow,
  });

  return { ok: true };
}
