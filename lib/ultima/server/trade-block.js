import { ULTIMA_LEAGUES } from "@/lib/ultima/constants";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { getManagerRoster } from "@/lib/ultima/server/lineup";
import { notifyShortlistListed } from "@/lib/ultima/server/notifications";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { notifyManagerOnceAsync } from "@/lib/ultima/server/notify";
import { listManagerUntouchables, listUntouchables } from "@/lib/ultima/server/untouchables";
import { LOOKING_FOR_MAX } from "@/lib/ultima/trades/rules";

export const TRADE_BLOCK_STANCES = ["listed", "open"];
const ASKS_PER_DAY = 20;
const NOTE_MAX = 80;
const MESSAGE_MAX = 120;

function cleanText(value, max) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, max);
  if (!text || /https?:\/\//i.test(text)) return null;
  return text;
}

function slim(player) {
  return {
    id: player.id,
    name: player.name,
    club: player.club,
    league: player.league,
    position: player.position ?? null,
    bolt_eligible: Boolean(player.bolt_eligible),
    seed_metrics: player.seed_metrics ?? {},
  };
}

/**
 * Board for the trades page. Rows for players no longer on the owner's squad
 * are ignored, so a drop or an executed trade never leaves a stale listing.
 */
export async function buildTradeBoard({ competitionId, managerId, clubs, rosters }) {
  const db = getUltimaDb();
  const empty = {
    mine: {},
    prefs: { looking_for: [], note: "" },
    sellers: [],
    inbox: [],
    asked: [],
    untouchable: {},
  };
  if (!db || !competitionId || !managerId) return empty;

  const humanIds = clubs.filter((c) => !c.is_bot).map((c) => c.id);
  const [{ data: blockRows }, { data: prefRows }, { data: interestRows }] = await Promise.all([
    db
      .from("ultima_trade_block")
      .select("manager_id, player_id, stance, note, updated_at")
      .in("manager_id", humanIds),
    db.from("ultima_trade_prefs").select("manager_id, looking_for, note").in("manager_id", humanIds),
    db
      .from("ultima_trade_interest")
      .select("id, from_manager_id, to_manager_id, player_id, message, state, created_at")
      .eq("competition_id", competitionId)
      .or(`from_manager_id.eq.${managerId},to_manager_id.eq.${managerId}`)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const rosterById = Object.fromEntries(
    Object.entries(rosters).map(([id, list]) => [id, new Map(list.map((p) => [p.id, p]))]),
  );
  const prefsById = Object.fromEntries((prefRows ?? []).map((p) => [p.manager_id, p]));
  const clubById = new Map(clubs.map((c) => [c.id, c]));

  const untouchable = await listUntouchables(competitionId);
  const untouchableSet = new Set(Object.values(untouchable).flat());

  const live = (blockRows ?? [])
    .filter((row) => rosterById[row.manager_id]?.has(row.player_id))
    .filter((row) => !untouchableSet.has(row.player_id));

  const mine = {};
  for (const row of live.filter((r) => r.manager_id === managerId)) {
    mine[row.player_id] = { stance: row.stance, note: row.note ?? "" };
  }

  const asked = (interestRows ?? [])
    .filter((row) => row.from_manager_id === managerId)
    .map((row) => ({ to: row.to_manager_id, player: row.player_id, state: row.state }));
  const askedKey = new Set(asked.map((a) => `${a.to}:${a.player ?? "all"}`));

  const sellers = humanIds
    .filter((id) => id !== managerId)
    .map((id) => {
      const club = clubById.get(id);
      const players = live
        .filter((row) => row.manager_id === id)
        .map((row) => ({
          ...slim(rosterById[id].get(row.player_id)),
          stance: row.stance,
          note: row.note ?? "",
          updated_at: row.updated_at ?? null,
          asked: askedKey.has(`${id}:${row.player_id}`),
        }))
        .sort((a, b) => (a.stance === b.stance ? 0 : a.stance === "listed" ? -1 : 1));
      const prefs = prefsById[id];
      return {
        id,
        team_name: club.team_name,
        manager_name: club.manager_name,
        colour: club.colour,
        rank: club.rank,
        looking_for: prefs?.looking_for ?? [],
        note: prefs?.note ?? "",
        asked: askedKey.has(`${id}:all`),
        players,
      };
    })
    .filter((seller) => seller.players.length)
    .sort((a, b) => a.rank - b.rank);

  const inbox = (interestRows ?? [])
    .filter((row) => row.to_manager_id === managerId && row.state !== "dismissed")
    .map((row) => {
      const from = clubById.get(row.from_manager_id);
      const player = row.player_id ? rosterById[managerId]?.get(row.player_id) : null;
      return {
        id: row.id,
        state: row.state,
        createdAt: row.created_at,
        message: row.message ?? "",
        from: from
          ? { id: from.id, team_name: from.team_name, manager_name: from.manager_name, colour: from.colour }
          : { id: row.from_manager_id, team_name: "A club", manager_name: "-", colour: "slate" },
        player: player ? slim(player) : null,
      };
    });

  return {
    mine,
    prefs: {
      looking_for: prefsById[managerId]?.looking_for ?? [],
      note: prefsById[managerId]?.note ?? "",
    },
    sellers,
    inbox,
    asked,
    untouchable,
  };
}

export async function setBlockStance({ competitionId, managerId, playerId, stance, note }) {
  const db = getUltimaDb();
  if (!db || !managerId || !playerId) return { ok: false, code: "UNAVAILABLE" };

  const roster = await getManagerRoster(managerId);
  if (!roster.some((p) => p.id === playerId)) {
    return { ok: false, code: "INVALID", message: "That player is not on your squad." };
  }

  if (!stance) {
    const { error } = await db
      .from("ultima_trade_block")
      .delete()
      .eq("manager_id", managerId)
      .eq("player_id", playerId);
    if (error) return { ok: false, code: "UNAVAILABLE" };
    return { ok: true, stance: null };
  }

  if (!TRADE_BLOCK_STANCES.includes(stance)) {
    return { ok: false, code: "INVALID", message: "Pick listed or open." };
  }

  if ((await listManagerUntouchables(managerId)).includes(playerId)) {
    return { ok: false, code: "INVALID", message: "Untouchable players stay off the block." };
  }

  const { data: before } = await db
    .from("ultima_trade_block")
    .select("stance")
    .eq("manager_id", managerId)
    .eq("player_id", playerId)
    .maybeSingle();

  const { error } = await db.from("ultima_trade_block").upsert(
    {
      manager_id: managerId,
      player_id: playerId,
      stance,
      note: cleanText(note, NOTE_MAX),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "manager_id,player_id" },
  );
  if (error) return { ok: false, code: "UNAVAILABLE" };

  await recordUltimaEvent({
    event: "trade_block_set",
    managerId,
    competitionId,
    payload: { player_id: playerId, stance },
  });
  // Shortlisted by others and newly transfer listed: tell them.
  if (stance === "listed" && before?.stance !== "listed") {
    await notifyShortlistListed({ ownerId: managerId, playerId, competitionId });
  }
  return { ok: true, stance };
}

export async function setTradePrefs({ managerId, lookingFor, note }) {
  const db = getUltimaDb();
  if (!db || !managerId) return { ok: false, code: "UNAVAILABLE" };
  const leagues = (Array.isArray(lookingFor) ? lookingFor : []).filter((l) => ULTIMA_LEAGUES.includes(l));
  const { error } = await db.from("ultima_trade_prefs").upsert(
    {
      manager_id: managerId,
      looking_for: [...new Set(leagues)],
      note: cleanText(note, LOOKING_FOR_MAX),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "manager_id" },
  );
  if (error) return { ok: false, code: "UNAVAILABLE" };
  return { ok: true };
}

/** A manager asks another manager about a listed player, or about their block in general. */
export async function askAboutPlayer({ competitionId, fromId, toId, playerId = null, message }) {
  const db = getUltimaDb();
  if (!db || !fromId || !toId) return { ok: false, code: "UNAVAILABLE" };
  if (fromId === toId) return { ok: false, code: "INVALID", message: "That is your own player." };

  const { data: target } = await db
    .from("ultima_managers")
    .select("id, is_bot, competition_id, team_name")
    .eq("id", toId)
    .maybeSingle();
  if (!target || target.is_bot || target.competition_id !== competitionId) {
    return { ok: false, code: "UNAVAILABLE" };
  }

  if (playerId) {
    const { data: row } = await db
      .from("ultima_trade_block")
      .select("player_id")
      .eq("manager_id", toId)
      .eq("player_id", playerId)
      .maybeSingle();
    const roster = await getManagerRoster(toId);
    if (!row || !roster.some((p) => p.id === playerId)) {
      return { ok: false, code: "INVALID", message: "That player is no longer on the block." };
    }
  } else {
    const { count } = await db
      .from("ultima_trade_block")
      .select("player_id", { count: "exact", head: true })
      .eq("manager_id", toId);
    if (!count) {
      return { ok: false, code: "INVALID", message: "That manager has nobody on the block." };
    }
  }

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count: recent } = await db
    .from("ultima_trade_interest")
    .select("id", { count: "exact", head: true })
    .eq("from_manager_id", fromId)
    .gte("created_at", since);
  if ((recent ?? 0) >= ASKS_PER_DAY) {
    return { ok: false, code: "INVALID", message: "That is plenty of asks for today. Try again tomorrow." };
  }

  const { data: row, error } = await db
    .from("ultima_trade_interest")
    .insert({
      competition_id: competitionId,
      from_manager_id: fromId,
      to_manager_id: toId,
      player_id: playerId,
      message: cleanText(message, MESSAGE_MAX),
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    return { ok: true, duplicate: true };
  }
  if (error || !row) return { ok: false, code: "UNAVAILABLE" };

  await recordUltimaEvent({
    event: "trade_interest",
    managerId: fromId,
    competitionId,
    payload: { to: toId, player_id: playerId },
  });

  const { data: from } = await db
    .from("ultima_managers")
    .select("team_name")
    .eq("id", fromId)
    .maybeSingle();

  notifyManagerOnceAsync({
    managerId: toId,
    kind: "trade_interest",
    refId: row.id,
    subject: "Ultima: a manager is interested",
    headline: "Interest in your trade block",
    body: `${from?.team_name ?? "A manager"} would like to talk trades.`,
    ctaLabel: "Open the trade desk",
    ctaHref: "/ultima/trades",
  });

  return { ok: true, id: row.id };
}

export async function resolveInterest({ managerId, interestId, state }) {
  const db = getUltimaDb();
  if (!db || !managerId || !interestId) return { ok: false, code: "UNAVAILABLE" };
  if (!["seen", "offered", "dismissed"].includes(state)) {
    return { ok: false, code: "INVALID", message: "Unknown action." };
  }
  const { data, error } = await db
    .from("ultima_trade_interest")
    .update({ state })
    .eq("id", interestId)
    .eq("to_manager_id", managerId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, code: "UNAVAILABLE" };
  return { ok: true };
}
