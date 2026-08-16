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
import { getBotPersonas } from "@/lib/ultima/personas";
import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { notifyAutoPickAsync, notifyOnClockAsync } from "@/lib/ultima/server/notify";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import {
  checkPlayerPool,
  describePoolShortfall,
  getDraftedPlayerIds,
  getUndraftedPlayers,
  markBoltEligible,
} from "@/lib/ultima/server/players";
import { getStatsProvider } from "@/lib/ultima/provider/index";
import { listBotPickCandidates } from "@/lib/ultima/bots/pick";

const TOTAL_PICKS = ULTIMA_TOTAL_PICKS;
const BOT_PICK_TAKEN_RETRIES = 3;

function pickFail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

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
    competition_id: ctx.competitionId,
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
  const pickNumber = draftState?.current_pick ?? null;

  if (draftState.state !== "live") {
    return pickFail(
      "NOT_YOUR_TURN",
      `Draft is not live. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  const onClock = managerOnClock(order, draftState.current_pick);
  if (!onClock || onClock.managerId !== managerId) {
    return pickFail(
      "NOT_YOUR_TURN",
      `Not your turn. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  const available = availableOverride ?? (await getUndraftedPlayers(competitionId));
  const player = available.find((p) => p.id === playerId);
  if (!player) {
    return pickFail(
      "PICK_TAKEN",
      `Player already drafted or missing from live undrafted set. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  const pickCount = draftState.current_pick <= 1 ? 0 : await countManagerPicks(competitionId, managerId);
  const counts = await getManagerPickCounts(competitionId, managerId);
  const slotsLeft = remainingSlots(pickCount);
  const supply = supplyByLeague(available);

  if (wouldBreakFloor(counts, player.league, slotsLeft, supply)) {
    return pickFail(
      "FLOOR_IMPOSSIBLE",
      `That pick would make the league floor impossible. player=${playerId} pick=${pickNumber} league=${player.league}`,
      { playerId, pickNumber },
    );
  }

  const forced = forcedLeagues(counts, slotsLeft);
  if (forced.length && !forced.includes(player.league)) {
    return pickFail(
      "FLOOR_VIOLATION",
      `${leagueLabel(forced[0])} only. You need ${forced.length} more. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  return {
    ok: true,
    player,
    forced: forced.includes(player.league),
    forcedLeague: forced.includes(player.league) ? player.league : null,
  };
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

async function claimPickViaRpc({
  competitionId,
  managerId,
  playerId,
  pickNumber,
  round,
  autoPicked,
  forced,
  forcedLeague,
  rationale,
  timerSeconds,
}) {
  const db = getUltimaDb();
  const { data, error } = await db.rpc("ultima_claim_draft_pick", {
    p_competition_id: competitionId,
    p_manager_id: managerId,
    p_player_id: playerId,
    p_expected_pick: pickNumber,
    p_round: round,
    p_auto_picked: autoPicked,
    p_forced: forced,
    p_forced_league: forcedLeague,
    p_rationale: rationale,
    p_timer_seconds: timerSeconds,
    p_total_picks: TOTAL_PICKS,
  });

  if (error) {
    // Migration not applied yet — caller falls back to stepwise claim.
    if (
      /could not find the function|function .* does not exist|PGRST202/i.test(
        error.message ?? "",
      )
    ) {
      return { ok: false, missing: true, message: error.message };
    }
    return pickFail(
      "UNAVAILABLE",
      `Claim RPC failed: ${error.message}. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  if (!data?.ok) {
    return pickFail(
      data?.code ?? "PICK_TAKEN",
      data?.message ??
        `Claim rejected. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  return {
    ok: true,
    pickNumber: data.pickNumber ?? pickNumber,
    nextPick: data.nextPick ?? pickNumber + 1,
    complete: Boolean(data.complete),
  };
}

async function claimPickStepwise({
  competitionId,
  managerId,
  player,
  pickNumber,
  round,
  autoPicked,
  forced,
  forcedLeague,
  rationale,
  timerSeconds,
  mutatePlayerPool,
}) {
  const db = getUltimaDb();
  const playerId = player.id;

  // Live taken set immediately before write (same request as insert).
  const taken = await getDraftedPlayerIds(competitionId);
  if (taken.has(playerId)) {
    return pickFail(
      "PICK_TAKEN",
      `Player already drafted at write time. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  const { data: clock, error: clockErr } = await db
    .from("ultima_draft_state")
    .select("current_pick, state")
    .eq("competition_id", competitionId)
    .maybeSingle();

  if (clockErr || !clock) {
    return pickFail(
      "UNAVAILABLE",
      `Could not read clock before insert. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  if (clock.state !== "live" || clock.current_pick !== pickNumber) {
    return pickFail(
      "PICK_TAKEN",
      `Clock moved before insert. expected_pick=${pickNumber} actual_pick=${clock.current_pick} player=${playerId}`,
      { playerId, pickNumber },
    );
  }

  const { error: pickErr } = await db.from("ultima_draft_picks").insert({
    competition_id: competitionId,
    manager_id: managerId,
    player_id: playerId,
    round,
    pick_number: pickNumber,
    auto_picked: autoPicked,
    forced,
    forced_league: forcedLeague,
    rationale,
  });

  if (pickErr) {
    if (pickErr.code === "23505") {
      return pickFail(
        "PICK_TAKEN",
        `Unique conflict on draft pick. player=${playerId} pick=${pickNumber} detail=${pickErr.message}`,
        { playerId, pickNumber },
      );
    }
    return pickFail(
      "UNAVAILABLE",
      `Pick insert failed: ${pickErr.message}. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  const { error: rosterErr } = await db.from("ultima_rosters").insert({
    competition_id: competitionId,
    manager_id: managerId,
    player_id: playerId,
  });

  if (rosterErr) {
    await db
      .from("ultima_draft_picks")
      .delete()
      .eq("competition_id", competitionId)
      .eq("pick_number", pickNumber);

    return pickFail(
      rosterErr.code === "23505" ? "PICK_TAKEN" : "UNAVAILABLE",
      `Roster insert failed: ${rosterErr.message}. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  if (mutatePlayerPool) {
    await db
      .from("ultima_players")
      .update({
        draft_round: round,
        bolt_eligible: markBoltEligible(round),
      })
      .eq("id", playerId);
  }

  const nextPick = pickNumber + 1;
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

  const { data: advanced, error: stateErr } = await db
    .from("ultima_draft_state")
    .update(updates)
    .eq("competition_id", competitionId)
    .eq("current_pick", pickNumber)
    .select("current_pick");

  if (stateErr) {
    return pickFail(
      "UNAVAILABLE",
      `Clock update failed: ${stateErr.message}. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  if (!advanced?.length) {
    await db
      .from("ultima_rosters")
      .delete()
      .eq("competition_id", competitionId)
      .eq("player_id", playerId);
    await db
      .from("ultima_draft_picks")
      .delete()
      .eq("competition_id", competitionId)
      .eq("pick_number", pickNumber);

    return pickFail(
      "PICK_TAKEN",
      `Clock was claimed by another writer. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  return {
    ok: true,
    pickNumber,
    nextPick,
    complete: nextPick > TOTAL_PICKS,
  };
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
  // Clock + managers only — never reuse a chain-stale undrafted pool here.
  const ctx = await loadDraftContext(competitionId, { includeAvailable: false });
  if (!ctx) {
    return pickFail(
      "UNAVAILABLE",
      `Draft context unavailable. player=${playerId} pick=null`,
      { playerId, pickNumber: null },
    );
  }

  const pickNumber = ctx.state.current_pick;
  const liveAvailable = await getUndraftedPlayers(competitionId);

  const validation = await validatePick({
    competitionId,
    managerId,
    playerId,
    draftState: ctx.state,
    order: ctx.order,
    available: liveAvailable,
  });

  if (!validation.ok && !autoPicked) {
    return validation;
  }

  const player = validation.player ?? liveAvailable.find((p) => p.id === playerId);
  if (!player) {
    return pickFail(
      "PICK_TAKEN",
      `Player not in live undrafted set. player=${playerId} pick=${pickNumber}`,
      { playerId, pickNumber },
    );
  }

  const round = Math.ceil(pickNumber / ULTIMA_MAX_SEATS);
  const forcedFlag = forced || Boolean(validation.forced);
  const forcedLeagueValue = forcedLeague ?? validation.forcedLeague ?? null;
  const timerSeconds = ctx.timerSeconds;

  let claim = await claimPickViaRpc({
    competitionId,
    managerId,
    playerId: player.id,
    pickNumber,
    round,
    autoPicked,
    forced: forcedFlag,
    forcedLeague: forcedLeagueValue,
    rationale,
    timerSeconds,
  });

  if (claim.missing) {
    claim = await claimPickStepwise({
      competitionId,
      managerId,
      player,
      pickNumber,
      round,
      autoPicked,
      forced: forcedFlag,
      forcedLeague: forcedLeagueValue,
      rationale,
      timerSeconds,
      mutatePlayerPool: opts.mutatePlayerPool,
    });
  } else if (claim.ok && opts.mutatePlayerPool) {
    await db
      .from("ultima_players")
      .update({
        draft_round: round,
        bolt_eligible: markBoltEligible(round),
      })
      .eq("id", player.id);
  }

  if (!claim.ok) {
    return claim;
  }

  const nextPick = claim.nextPick;

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
    forced: forcedFlag,
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

  return {
    ok: true,
    pickNumber,
    nextPick,
    complete: Boolean(claim.complete) || nextPick > TOTAL_PICKS,
  };
}

export async function processBotTurns(competitionId, options = {}) {
  const opts = mergeDraftOpts(options);
  let safety = Math.min(opts.maxBotPicks ?? 20, 20);
  let picked = 0;
  while (safety > 0) {
    safety -= 1;
    // Clock only — undrafted set is re-read inside computeBotPick every turn.
    const ctx = await loadDraftContext(competitionId, { includeAvailable: false });
    if (!ctx || ctx.state.state !== "live") break;

    const manager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
    if (!manager || (!manager.is_bot && !manager.auto_draft)) break;

    const pickNumber = ctx.state.current_pick;
    let candidates;
    try {
      candidates = await computeBotCandidates(ctx, manager);
    } catch (err) {
      console.error("Ultima bot pick failed", {
        competition_id: competitionId,
        current_pick: pickNumber,
        message: err?.message ?? String(err),
      });
      return pickFail(
        "BOT_PICK_FAILED",
        `${err?.message ?? "Bot could not pick."} pick=${pickNumber}`,
        { picked, pickNumber },
      );
    }

    if (!candidates.length) {
      return pickFail(
        "BOT_PICK_FAILED",
        `Bot found no valid player in live undrafted set. pick=${pickNumber}`,
        { picked, pickNumber },
      );
    }

    let result = null;
    const attempts = Math.min(BOT_PICK_TAKEN_RETRIES, candidates.length);
    for (let i = 0; i < attempts; i += 1) {
      const pick = candidates[i];
      result = await executePick({
        competitionId,
        managerId: manager.id,
        playerId: pick.player.id,
        autoPicked: true,
        forced: pick.forced,
        forcedLeague: pick.forcedLeague,
        rationale: pick.rationale,
        options: { ...opts, skipBotChain: true },
      });

      if (result.ok) break;

      if (result.code === "PICK_TAKEN") {
        console.warn("Ultima PICK_TAKEN on bot pick — live undrafted read may still be wrong", {
          competition_id: competitionId,
          persona_id: manager.persona_id ?? null,
          player_id: pick.player.id,
          pick_number: pickNumber,
          attempt: i + 1,
          message: result.message,
        });
        continue;
      }

      return {
        ok: false,
        code: result.code ?? "BOT_PICK_FAILED",
        message:
          result.message ??
          `Bot pick did not land. player=${pick.player.id} pick=${pickNumber}`,
        picked,
        playerId: pick.player.id,
        pickNumber,
      };
    }

    if (!result?.ok) {
      const last = candidates[attempts - 1];
      return {
        ok: false,
        code: result?.code ?? "PICK_TAKEN",
        message:
          result?.message ??
          `Bot exhausted PICK_TAKEN retries. player=${last?.player?.id ?? "none"} pick=${pickNumber}`,
        picked,
        playerId: last?.player?.id ?? null,
        pickNumber,
      };
    }

    picked += 1;
    if (result.complete) break;
  }
  return { ok: true, picked };
}

async function computeBotCandidates(ctx, manager) {
  const personas = getBotPersonas();
  const persona =
    personas.find((p) => p.id === manager.persona_id) ??
    manager.ultima_bot_personas ??
    personas[0];

  // Live undrafted set at selection time — not a snapshot from earlier in the chain.
  const availablePlayers = await getUndraftedPlayers(ctx.competitionId);
  const counts = await getManagerPickCounts(ctx.competitionId, manager.id);
  const pickCount = await countManagerPicks(ctx.competitionId, manager.id);
  const slotsLeft = remainingSlots(pickCount);
  const supply = supplyByLeague(availablePlayers);

  const db = getUltimaDb();
  const { data: queue } = await db
    .from("ultima_draft_queues")
    .select("player_id")
    .eq("manager_id", manager.id)
    .order("position");

  return listBotPickCandidates({
    persona,
    availablePlayers,
    managerCounts: counts,
    slotsLeft,
    supplyByLeague: supply,
    queuePlayerIds: (queue ?? []).map((q) => q.player_id),
    draftRound: Math.ceil(ctx.state.current_pick / ULTIMA_MAX_SEATS),
  });
}

async function computeBotPick(ctx, manager) {
  const candidates = await computeBotCandidates(ctx, manager);
  return candidates[0] ?? null;
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

  if (!player) {
    return pickFail(
      "UNAVAILABLE",
      `Auto-pick found no undrafted player. manager=${managerId} pick=${ctx.state.current_pick}`,
      { playerId: null, pickNumber: ctx.state.current_pick },
    );
  }

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
    const botResult = await processBotTurns(competitionId, opts);
    const after = await clockAfterAdvance(competitionId);
    if (!botResult?.ok) {
      return {
        ok: false,
        advanced: false,
        code: botResult?.code ?? "BOT_PICK_FAILED",
        message:
          botResult?.message ??
          `Bot could not pick. pick=${after.current_pick ?? clock.state.current_pick}`,
        playerId: botResult?.playerId ?? null,
        pickNumber: botResult?.pickNumber ?? after.current_pick ?? null,
        ...after,
      };
    }
    if ((botResult.picked ?? 0) === 0 && after.on_clock_is_bot) {
      return {
        ok: false,
        advanced: false,
        code: "BOT_PICK_FAILED",
        message: `Bot did not advance the clock. pick=${after.current_pick ?? clock.state.current_pick}`,
        pickNumber: after.current_pick ?? null,
        ...after,
      };
    }
    return { ok: true, advanced: true, ...after };
  }

  if (expired) {
    const result = await autoPickOnExpiry(competitionId, opts);
    return { ...result, ...(await clockAfterAdvance(competitionId)) };
  }

  return { ok: true, skipped: true };
}

async function clockAfterAdvance(competitionId) {
  const after = await loadDraftContext(competitionId, { includeAvailable: false });
  const nextMgr = after?.managers.find((m) => m.id === after.onClock?.managerId);
  return {
    current_pick: after?.state?.current_pick ?? null,
    on_clock_is_bot: Boolean(nextMgr && (nextMgr.is_bot || nextMgr.auto_draft)),
  };
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
