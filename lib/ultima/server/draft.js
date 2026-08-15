import { ULTIMA_DRAFT_ROUNDS, ULTIMA_MAX_SEATS, ULTIMA_TOTAL_PICKS, ULTIMA_LEAGUES, ULTIMA_TIMER_OPTIONS, leagueLabel } from "@/lib/ultima/constants";
import { managerOnClock, buildSnakeDraftOrder } from "@/lib/ultima/draft/snake";
import {
  countByLeague,
  wouldBreakFloor,
  remainingSlots,
  forcedLeagues,
  floorCounterState,
  formatFloorCounter,
} from "@/lib/ultima/draft/floor";
import { chooseBotPick } from "@/lib/ultima/bots/pick";
import { getBotPersonas } from "@/lib/ultima/personas";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { notifyAutoPickAsync, notifyOnClockAsync } from "@/lib/ultima/server/notify";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import {
  checkPlayerPool,
  describePoolShortfall,
  getUndraftedPlayers,
  markBoltEligible,
} from "@/lib/ultima/server/players";
import { getStatsProvider } from "@/lib/ultima/provider/index";

const TOTAL_PICKS = ULTIMA_TOTAL_PICKS;

const DEFAULT_DRAFT_OPTS = {
  mutatePlayerPool: true,
  skipNotify: false,
  skipAdminLog: false,
  skipPlayerSync: false,
  skipBotChain: true,
  maxBotPicks: 20,
  eventScope: null,
};

function mergeDraftOpts(options) {
  return { ...DEFAULT_DRAFT_OPTS, ...options };
}

export async function loadDraftContext(competitionId, { includeAvailable = true } = {}) {
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
        .select("id, team_name, colour, is_bot, auto_draft, draft_slot, persona_id, user_id, ultima_bot_personas(*)")
        .eq("competition_id", competitionId)
        .order("draft_slot"),
      db
        .from("ultima_draft_picks")
        .select(
          "pick_number, round, manager_id, forced, rationale, auto_picked, ultima_players(id, name, club, league), ultima_managers(id, team_name, is_bot)",
        )
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
  const available = includeAvailable ? await getUndraftedPlayers(competitionId) : [];

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

export function slimPoolPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    club: p.club,
    league: p.league,
    seed_metrics: {
      rating_avg: p.seed_metrics?.rating_avg ?? 0,
      goals_rate: p.seed_metrics?.goals_rate ?? 0,
      assists_rate: p.seed_metrics?.assists_rate ?? 0,
    },
  };
}

export async function buildDraftRoomPayload(ctx, { manager, queue = [], extra = {} }) {
  const onClockManager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
  const myCounts = await getManagerPickCounts(ctx.competitionId, manager.id);
  const myPickCount = ctx.picks.filter((p) => p.manager_id === manager.id).length;
  const counter = floorCounterState(myCounts, remainingSlots(myPickCount));

  let secondsRemaining = null;
  if (ctx.state.turn_expires_at && ctx.state.state === "live") {
    secondsRemaining = Math.max(
      0,
      Math.floor((new Date(ctx.state.turn_expires_at).getTime() - Date.now()) / 1000),
    );
  }

  return {
    state: ctx.state.state,
    current_pick: ctx.state.current_pick,
    picks: ctx.picks.map((p) => ({
      pick_number: p.pick_number,
      round: p.round,
      manager_id: p.manager_id,
      manager_name: p.ultima_managers?.team_name,
      is_bot: p.ultima_managers?.is_bot,
      player: p.ultima_players
        ? {
            id: p.ultima_players.id,
            name: p.ultima_players.name,
            club: p.ultima_players.club,
            league: p.ultima_players.league,
          }
        : null,
      forced: p.forced,
      rationale: p.rationale,
      auto_picked: p.auto_picked,
    })),
    on_clock: onClockManager
      ? {
          id: onClockManager.id,
          team_name: onClockManager.team_name,
          is_bot: onClockManager.is_bot,
          is_you: onClockManager.id === manager.id,
        }
      : null,
    is_your_turn: ctx.onClock?.managerId === manager.id,
    auto_draft: Boolean(
      ctx.managers.find((m) => m.id === manager.id)?.auto_draft ?? manager.auto_draft,
    ),
    timer_seconds: ctx.timerSeconds,
    seconds_remaining: secondsRemaining,
    floor_counter: formatFloorCounter(counter.counts, counter.deficits, counter.slotsLeft),
    floor_mode: counter.mode,
    queue,
    managers: ctx.managers.map((m) => ({
      id: m.id,
      team_name: m.team_name,
      colour: m.colour,
      is_bot: m.is_bot,
      draft_slot: m.draft_slot,
    })),
    ...extra,
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
  available: availableOverride,
}) {
  if (draftState.state !== "live") {
    return { ok: false, code: "NOT_YOUR_TURN", message: "Draft is not live." };
  }

  const onClock = managerOnClock(order, draftState.current_pick);
  if (!onClock || onClock.managerId !== managerId) {
    return { ok: false, code: "NOT_YOUR_TURN" };
  }

  const available = availableOverride ?? (await getUndraftedPlayers(competitionId));
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
  options = {},
}) {
  const opts = mergeDraftOpts(options);
  const db = getUltimaDb();
  const ctx = await loadDraftContext(competitionId);
  if (!ctx) return { ok: false, code: "UNAVAILABLE" };

  const validation = await validatePick({
    competitionId,
    managerId,
    playerId,
    draftState: ctx.state,
    order: ctx.order,
    available: ctx.available,
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

  const { error: rosterErr } = await db.from("ultima_rosters").insert({
    competition_id: competitionId,
    manager_id: managerId,
    player_id: player.id,
  });

  if (rosterErr) {
    // The squad row is the source of truth for scoring, so a pick without one
    // is worse than no pick at all. Undo it rather than leave a ghost.
    await db
      .from("ultima_draft_picks")
      .delete()
      .eq("competition_id", competitionId)
      .eq("pick_number", pickNumber);

    return { ok: false, code: rosterErr.code === "23505" ? "PICK_TAKEN" : "UNAVAILABLE" };
  }

  if (opts.mutatePlayerPool) {
    await db
      .from("ultima_players")
      .update({
        draft_round: round,
        bolt_eligible: markBoltEligible(round),
      })
      .eq("id", player.id);
  }

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

  const { error: stateErr } = await db
    .from("ultima_draft_state")
    .update(updates)
    .eq("competition_id", competitionId);

  if (stateErr) {
    return { ok: false, code: "UNAVAILABLE", error: stateErr.message };
  }

  await recordUltimaEvent({
    event: "pick_made",
    managerId,
    competitionId,
    payload: { player_id: player.id, pick_number: pickNumber, round },
  });

  publishUltimaEvent("draft.pick", {
    manager_id: managerId,
    player,
    round,
    pick_number: pickNumber,
    forced,
    rationale,
    scope: opts.eventScope,
  });

  if (nextPick > TOTAL_PICKS) {
    publishUltimaEvent("draft.state", { state: "complete", scope: opts.eventScope });
  } else {
    publishUltimaEvent("draft.tick", {
      pick_number: nextPick,
      seconds_remaining: timerSeconds,
      scope: opts.eventScope,
    });
  }

  if (nextPick <= TOTAL_PICKS && opts.skipBotChain === false) {
    await processBotTurns(competitionId, opts);
  }

  if (autoPicked && !opts.skipNotify) {
    const manager = ctx.managers.find((m) => m.id === managerId);
    if (manager && !manager.is_bot) {
      notifyAutoPickAsync({
        managerId,
        pickNumber,
        playerName: player.name,
      });
    }
  }

  if (!opts.skipNotify) {
    await notifyOnClockIfHuman(competitionId, timerSeconds);
  }

  return { ok: true, pickNumber, nextPick, complete: nextPick > TOTAL_PICKS };
}

export async function processBotTurns(competitionId, options = {}) {
  const opts = mergeDraftOpts(options);
  let safety = Math.min(opts.maxBotPicks ?? 20, 20);
  while (safety > 0) {
    safety -= 1;
    const ctx = await loadDraftContext(competitionId);
    if (!ctx || ctx.state.state !== "live") break;

    const manager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
    if (!manager || (!manager.is_bot && !manager.auto_draft)) break;

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
      options: { ...opts, skipBotChain: true },
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

export async function autoPickOnExpiry(competitionId, options = {}) {
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
    options,
  });
}

export async function startDraft(competitionId, actorId, options = {}) {
  const opts = mergeDraftOpts(options);
  const db = getUltimaDb();
  if (!db) return { ok: false, error: "no_db" };

  const { seatBots } = await import("@/lib/ultima/bots/seat");
  const { syncPlayerPool } = await import("@/lib/ultima/server/players");

  if (!opts.skipPlayerSync) {
    await syncPlayerPool();
  }

  // A draft that starts on a pool too small to finish leaves every manager
  // staring at an empty board with no way out, so refuse before going live.
  const pool = await checkPlayerPool();
  if (!pool.ok) {
    return {
      ok: false,
      code: "POOL_EMPTY",
      error: "insufficient_pool",
      message: describePoolShortfall(pool),
      pool,
    };
  }

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

  if (!opts.skipAdminLog && actorId) {
    await db.from("ultima_admin_log").insert({
      actor_id: actorId,
      action: "draft_started",
      reason: null,
      payload: { order },
    });
  }

  publishUltimaEvent("draft.state", { state: "live", scope: opts.eventScope });

  if (!opts.skipNotify) {
    await notifyOnClockIfHuman(competitionId, timerSeconds);
  }

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

export async function setDraftTimer(competitionId, timerSeconds, options = {}) {
  const opts = mergeDraftOpts(options);
  const seconds = Number(timerSeconds);
  if (!ULTIMA_TIMER_OPTIONS.includes(seconds)) {
    return { ok: false, code: "INVALID", message: "Choose a listed timer." };
  }

  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  await db
    .from("ultima_competition")
    .update({ timer_seconds: seconds, updated_at: new Date().toISOString() })
    .eq("id", competitionId);

  const { data: state } = await db
    .from("ultima_draft_state")
    .select("state")
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (state?.state === "live") {
    await db
      .from("ultima_draft_state")
      .update({
        turn_expires_at: new Date(Date.now() + seconds * 1000).toISOString(),
      })
      .eq("competition_id", competitionId);
  }

  publishUltimaEvent("draft.tick", {
    seconds_remaining: seconds,
    scope: opts.eventScope,
  });

  return { ok: true, timer_seconds: seconds };
}

export async function setAutoDraft(managerId, enabled, options = {}) {
  const opts = mergeDraftOpts(options);
  const db = getUltimaDb();
  if (!db) return { ok: false, code: "UNAVAILABLE" };

  const { data: manager } = await db
    .from("ultima_managers")
    .select("id, competition_id")
    .eq("id", managerId)
    .maybeSingle();

  if (!manager) return { ok: false, code: "UNAVAILABLE" };

  const { error } = await db
    .from("ultima_managers")
    .update({ auto_draft: Boolean(enabled) })
    .eq("id", managerId);

  if (error) {
    return { ok: false, code: "UNAVAILABLE", message: error.message };
  }

  publishUltimaEvent("draft.state", {
    auto_draft: Boolean(enabled),
    manager_id: managerId,
    scope: opts.eventScope,
  });

  if (enabled) {
    await processBotTurns(manager.competition_id, opts);
  }

  return { ok: true, auto_draft: Boolean(enabled) };
}

/**
 * Advance the clock without painting the room. Cheap when a human is up:
 * we load the board, not the 2,700-player pool. Bots pick in small batches
 * so a Hobby request does not stall the first paint.
 */
export async function advanceDraft(competitionId, options = {}) {
  const opts = mergeDraftOpts({ maxBotPicks: 4, ...options });
  const clock = await loadDraftContext(competitionId, { includeAvailable: false });
  if (!clock || clock.state.state !== "live") return { ok: true, skipped: true };

  const manager = clock.managers.find((m) => m.id === clock.onClock?.managerId);
  const botTurn = Boolean(manager && (manager.is_bot || manager.auto_draft));
  const expired =
    Boolean(clock.state.turn_expires_at) &&
    new Date(clock.state.turn_expires_at).getTime() <= Date.now();

  if (botTurn) {
    await processBotTurns(competitionId, opts);
    return { ok: true, advanced: true };
  }

  if (expired) {
    return autoPickOnExpiry(competitionId, opts);
  }

  return { ok: true, skipped: true };
}

export async function expireLiveTurn(competitionId, options = {}) {
  return advanceDraft(competitionId, options);
}

async function notifyOnClockIfHuman(competitionId, timerSeconds) {
  const ctx = await loadDraftContext(competitionId);
  if (!ctx || ctx.state.state !== "live") return;

  const manager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
  if (!manager || manager.is_bot || manager.auto_draft) return;

  const seconds = timerSeconds ?? ctx.timerSeconds ?? 0;
  notifyOnClockAsync({
    managerId: manager.id,
    pickNumber: ctx.state.current_pick,
    secondsRemaining: seconds,
  });
}
