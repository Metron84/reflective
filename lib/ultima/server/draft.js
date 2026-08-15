import { ULTIMA_DRAFT_ROUNDS, ULTIMA_MAX_SEATS, ULTIMA_TOTAL_PICKS, ULTIMA_LEAGUES, leagueLabel } from "@/lib/ultima/constants";
import { managerOnClock, buildSnakeDraftOrder } from "@/lib/ultima/draft/snake";
import {
  countByLeague,
  wouldBreakFloor,
  remainingSlots,
  forcedLeagues,
} from "@/lib/ultima/draft/floor";
import { chooseBotPick } from "@/lib/ultima/bots/pick";
import { getBotPersonas } from "@/lib/ultima/personas";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { notifyAutoPickAsync, notifyOnClockAsync } from "@/lib/ultima/server/notify";
import { getUltimaDb } from "@/lib/ultima/server/db";
import {
  getUndraftedPlayers,
  markBoltEligible,
} from "@/lib/ultima/server/players";
import { getStatsProvider } from "@/lib/ultima/provider/index";

const TOTAL_PICKS = ULTIMA_TOTAL_PICKS;

export async function loadDraftContext(competitionId) {
  const db = getUltimaDb();
  if (!db) return null;

  const [{ data: state }, { data: managers }, { data: picks }, { data: competition }] =
    await Promise.all([
      db
        .from("ultima_draft_state")
        .select("*")
        .eq("competition_id", competitionId)
        .maybeSingle(),
      db
        .from("ultima_managers")
        .select("*, ultima_bot_personas(*)")
        .eq("competition_id", competitionId)
        .order("draft_slot"),
      db
        .from("ultima_draft_picks")
        .select("*, ultima_players(*), ultima_managers(id, team_name, is_bot, persona_id)")
        .eq("competition_id", competitionId)
        .order("pick_number"),
      db
        .from("ultima_competition")
        .select("*")
        .eq("id", competitionId)
        .maybeSingle(),
    ]);

  if (!state || !competition) return null;

  const order =
    state.draft_order?.length === ULTIMA_MAX_SEATS
      ? state.draft_order
      : (managers ?? []).map((m) => m.id);

  const onClock = managerOnClock(order, state.current_pick);
  const available = await getUndraftedPlayers(competitionId);

  return {
    competitionId,
    state,
    competition,
    managers: managers ?? [],
    picks: picks ?? [],
    order,
    onClock,
    available,
    timerSeconds: competition.timer_seconds ?? 60,
  };
}

function supplyByLeague(available) {
  const supply = Object.fromEntries(ULTIMA_LEAGUES.map((l) => [l, 0]));
  for (const p of available) supply[p.league] += 1;
  return supply;
}

export async function getManagerPickCounts(competitionId, managerId) {
  const db = getUltimaDb();
  const { data: picks } = await db
    .from("ultima_draft_picks")
    .select("ultima_players(league)")
    .eq("competition_id", competitionId)
    .eq("manager_id", managerId);

  return countByLeague(
    (picks ?? []).map((row) => row.ultima_players).filter(Boolean),
  );
}

export async function validatePick({
  competitionId,
  managerId,
  playerId,
  draftState,
  order,
}) {
  if (draftState.state !== "live") {
    return { ok: false, code: "NOT_YOUR_TURN", message: "Draft is not live." };
  }

  const onClock = managerOnClock(order, draftState.current_pick);
  if (!onClock || onClock.managerId !== managerId) {
    return { ok: false, code: "NOT_YOUR_TURN" };
  }

  const available = await getUndraftedPlayers(competitionId);
  const player = available.find((p) => p.id === playerId);
  if (!player) {
    return { ok: false, code: "PICK_TAKEN" };
  }

  const pickCount = draftState.current_pick <= 1 ? 0 : await countManagerPicks(competitionId, managerId);
  const counts = await getManagerPickCounts(competitionId, managerId);
  const slotsLeft = remainingSlots(pickCount);
  const supply = supplyByLeague(available);

  if (wouldBreakFloor(counts, player.league, slotsLeft, supply)) {
    return { ok: false, code: "FLOOR_IMPOSSIBLE" };
  }

  const forced = forcedLeagues(counts, slotsLeft);
  if (forced.length && !forced.includes(player.league)) {
    return { ok: false, code: "FLOOR_VIOLATION", message: `${leagueLabel(forced[0])} only. You need ${forced.length} more.` };
  }

  return { ok: true, player, forced: forced.includes(player.league), forcedLeague: forced.includes(player.league) ? player.league : null };
}

async function countManagerPicks(competitionId, managerId) {
  const db = getUltimaDb();
  const { count } = await db
    .from("ultima_draft_picks")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId)
    .eq("manager_id", managerId);
  return count ?? 0;
}

export async function executePick({
  competitionId,
  managerId,
  playerId,
  autoPicked = false,
  forced = false,
  forcedLeague = null,
  rationale = null,
}) {
  const db = getUltimaDb();
  const ctx = await loadDraftContext(competitionId);
  if (!ctx) return { ok: false, code: "UNAVAILABLE" };

  const validation = await validatePick({
    competitionId,
    managerId,
    playerId,
    draftState: ctx.state,
    order: ctx.order,
  });

  if (!validation.ok && !autoPicked) {
    return validation;
  }

  const player = validation.player ?? ctx.available.find((p) => p.id === playerId);
  if (!player) return { ok: false, code: "PICK_TAKEN" };

  const round = Math.ceil(ctx.state.current_pick / ULTIMA_MAX_SEATS);
  const pickNumber = ctx.state.current_pick;

  const { error: pickErr } = await db.from("ultima_draft_picks").insert({
    competition_id: competitionId,
    manager_id: managerId,
    player_id: player.id,
    round,
    pick_number: pickNumber,
    auto_picked: autoPicked,
    forced: forced || validation.forced,
    forced_league: forcedLeague ?? validation.forcedLeague,
    rationale,
  });

  if (pickErr) {
    if (pickErr.code === "23505") return { ok: false, code: "PICK_TAKEN" };
    return { ok: false, code: "UNAVAILABLE" };
  }

  await db.from("ultima_rosters").insert({
    manager_id: managerId,
    player_id: player.id,
  });

  await db
    .from("ultima_players")
    .update({
      draft_round: round,
      bolt_eligible: markBoltEligible(round),
    })
    .eq("id", player.id);

  const nextPick = pickNumber + 1;
  const timerSeconds = ctx.timerSeconds;
  const updates =
    nextPick > TOTAL_PICKS
      ? {
          state: "complete",
          current_pick: nextPick,
          completed_at: new Date().toISOString(),
          turn_expires_at: null,
        }
      : {
          current_pick: nextPick,
          turn_expires_at: new Date(Date.now() + timerSeconds * 1000).toISOString(),
        };

  await db
    .from("ultima_draft_state")
    .update(updates)
    .eq("competition_id", competitionId);

  await db.from("ultima_events").insert({
    event: "pick_made",
    manager_id: managerId,
    payload: { player_id: player.id, pick_number: pickNumber, round },
  });

  publishUltimaEvent("draft.pick", {
    manager_id: managerId,
    player,
    round,
    pick_number: pickNumber,
    forced,
    rationale,
  });

  if (nextPick > TOTAL_PICKS) {
    publishUltimaEvent("draft.state", { state: "complete" });
  } else {
    publishUltimaEvent("draft.tick", {
      pick_number: nextPick,
      seconds_remaining: timerSeconds,
    });
  }

  // Run bot picks in chain
  if (nextPick <= TOTAL_PICKS) {
    await processBotTurns(competitionId);
  }

  if (autoPicked) {
    const manager = ctx.managers.find((m) => m.id === managerId);
    if (manager && !manager.is_bot) {
      notifyAutoPickAsync({
        managerId,
        pickNumber,
        playerName: player.name,
      });
    }
  }

  await notifyOnClockIfHuman(competitionId, timerSeconds);

  return { ok: true, pickNumber, nextPick, complete: nextPick > TOTAL_PICKS };
}

export async function processBotTurns(competitionId) {
  let safety = 20;
  while (safety > 0) {
    safety -= 1;
    const ctx = await loadDraftContext(competitionId);
    if (!ctx || ctx.state.state !== "live") break;

    const manager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
    if (!manager?.is_bot) break;

    const pick = await computeBotPick(ctx, manager);
    if (!pick) break;

    const result = await executePick({
      competitionId,
      managerId: manager.id,
      playerId: pick.player.id,
      autoPicked: true,
      forced: pick.forced,
      forcedLeague: pick.forcedLeague,
      rationale: pick.rationale,
    });

    if (!result.ok) break;
    if (result.complete) break;
  }
}

async function computeBotPick(ctx, manager) {
  const personas = getBotPersonas();
  const persona =
    personas.find((p) => p.id === manager.persona_id) ??
    manager.ultima_bot_personas ??
    personas[0];

  const counts = await getManagerPickCounts(ctx.competitionId, manager.id);
  const pickCount = await countManagerPicks(ctx.competitionId, manager.id);
  const slotsLeft = remainingSlots(pickCount);
  const supply = supplyByLeague(ctx.available);

  const db = getUltimaDb();
  const { data: queue } = await db
    .from("ultima_draft_queues")
    .select("player_id")
    .eq("manager_id", manager.id)
    .order("position");

  return chooseBotPick({
    persona,
    availablePlayers: ctx.available,
    managerCounts: counts,
    slotsLeft,
    supplyByLeague: supply,
    queuePlayerIds: (queue ?? []).map((q) => q.player_id),
    draftRound: Math.ceil(ctx.state.current_pick / ULTIMA_MAX_SEATS),
  });
}

export async function autoPickOnExpiry(competitionId) {
  const ctx = await loadDraftContext(competitionId);
  if (!ctx || ctx.state.state !== "live") return { ok: false };

  const managerId = ctx.onClock?.managerId;
  if (!managerId) return { ok: false };

  const db = getUltimaDb();
  const { data: queue } = await db
    .from("ultima_draft_queues")
    .select("player_id")
    .eq("manager_id", managerId)
    .order("position");

  const counts = await getManagerPickCounts(competitionId, managerId);
  const pickCount = await countManagerPicks(competitionId, managerId);
  const slotsLeft = remainingSlots(pickCount);
  const supply = supplyByLeague(ctx.available);
  const forced = forcedLeagues(counts, slotsLeft);

  let player = null;
  for (const q of queue ?? []) {
    const p = ctx.available.find((a) => a.id === q.player_id);
    if (p && !wouldBreakFloor(counts, p.league, slotsLeft, supply)) {
      player = p;
      break;
    }
  }

  if (!player) {
    const provider = getStatsProvider();
    for (const league of ULTIMA_LEAGUES) {
      const ranked = provider.getRankings(league);
      for (const seed of ranked) {
        const p = ctx.available.find((a) => a.provider_id === seed.provider_id);
        if (p && !wouldBreakFloor(counts, p.league, slotsLeft, supply)) {
          if (!forced.length || forced.includes(p.league)) {
            player = p;
            break;
          }
        }
      }
      if (player) break;
    }
  }

  if (!player) {
    player = ctx.available.find(
      (p) =>
        !wouldBreakFloor(counts, p.league, slotsLeft, supply) &&
        (!forced.length || forced.includes(p.league)),
    );
  }

  if (!player) return { ok: false, code: "UNAVAILABLE" };

  return executePick({
    competitionId,
    managerId,
    playerId: player.id,
    autoPicked: true,
    forced: forced.includes(player.league),
    forcedLeague: forced.includes(player.league) ? player.league : null,
  });
}

export async function startDraft(competitionId, actorId) {
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const { seatBots } = await import("@/lib/ultima/bots/seat");
  const { syncPlayerPool } = await import("@/lib/ultima/server/players");

  await syncPlayerPool();
  await seatBots(competitionId);

  const { data: allManagers } = await db
    .from("ultima_managers")
    .select("id")
    .eq("competition_id", competitionId);

  if ((allManagers ?? []).length < ULTIMA_MAX_SEATS) {
    return { ok: false, error: "not_enough_seats" };
  }

  const order = shuffle((allManagers ?? []).map((m) => m.id)).slice(
    0,
    ULTIMA_MAX_SEATS,
  );
  buildSnakeDraftOrder(order);

  for (let i = 0; i < order.length; i += 1) {
    await db
      .from("ultima_managers")
      .update({ draft_slot: i + 1 })
      .eq("id", order[i]);
  }

  const { data: competition } = await db
    .from("ultima_competition")
    .select("timer_seconds")
    .eq("id", competitionId)
    .maybeSingle();

  const timerSeconds = competition?.timer_seconds ?? 60;

  await db
    .from("ultima_draft_state")
    .update({
      state: "live",
      draft_order: order,
      current_pick: 1,
      started_at: new Date().toISOString(),
      turn_expires_at: new Date(Date.now() + timerSeconds * 1000).toISOString(),
    })
    .eq("competition_id", competitionId);

  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action: "draft_started",
    reason: null,
    payload: { order },
  });

  publishUltimaEvent("draft.state", { state: "live" });

  await processBotTurns(competitionId);
  await notifyOnClockIfHuman(competitionId, timerSeconds);

  return { ok: true, order };
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function pauseDraft(competitionId, actorId) {
  const db = getUltimaDb();
  await db
    .from("ultima_draft_state")
    .update({
      state: "paused",
      paused_by: actorId,
      paused_at: new Date().toISOString(),
    })
    .eq("competition_id", competitionId);

  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action: "draft_paused",
    payload: {},
  });

  publishUltimaEvent("draft.state", { state: "paused" });
  return { ok: true };
}

export async function resumeDraft(competitionId, actorId, timerSeconds = 60) {
  const db = getUltimaDb();
  await db
    .from("ultima_draft_state")
    .update({
      state: "live",
      paused_by: null,
      paused_at: null,
      resume_at: new Date().toISOString(),
      turn_expires_at: new Date(Date.now() + timerSeconds * 1000).toISOString(),
    })
    .eq("competition_id", competitionId);

  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action: "draft_resumed",
    payload: {},
  });

  publishUltimaEvent("draft.state", { state: "live" });
  await processBotTurns(competitionId);
  await notifyOnClockIfHuman(competitionId, timerSeconds);
  return { ok: true };
}

async function notifyOnClockIfHuman(competitionId, timerSeconds) {
  const ctx = await loadDraftContext(competitionId);
  if (!ctx || ctx.state.state !== "live") return;

  const manager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
  if (!manager || manager.is_bot) return;

  const seconds = timerSeconds ?? ctx.timerSeconds ?? 0;
  notifyOnClockAsync({
    managerId: manager.id,
    pickNumber: ctx.state.current_pick,
    secondsRemaining: seconds,
  });
}
