import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { isCommissionerUser } from "@/lib/ultima/server/db";
import {
  startDraft,
  pauseDraft,
  resumeDraft,
  loadDraftContext,
  setDraftTimer,
  executePick,
} from "@/lib/ultima/server/draft";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { syncPlayerPool } from "@/lib/ultima/server/players";
import { bootstrapSampleGameweek } from "@/lib/ultima/server/bootstrap";
import {
  syncFixturesForGameweek,
  syncStatsForGameweek,
  runGameweekSync,
  createGameweek,
  getActiveGameweek,
} from "@/lib/ultima/server/sync";

export { isCommissionerUser };

export async function requireCommissioner(userId) {
  return isCommissionerUser(userId);
}

export async function commissionerStartDraft(competitionId, actorId) {
  if (!(await requireCommissioner(actorId))) {
    return { ok: false, code: "NOT_COMMISSIONER" };
  }
  return startDraft(competitionId, actorId);
}

export async function commissionerPauseDraft(competitionId, actorId) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };
  return pauseDraft(competitionId, actorId);
}

export async function commissionerResumeDraft(competitionId, actorId, timerSeconds) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };
  return resumeDraft(competitionId, actorId, timerSeconds);
}

export async function commissionerSetTimer(competitionId, actorId, timerSeconds) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };
  const result = await setDraftTimer(competitionId, timerSeconds);
  if (result.ok) {
    await dbAdminLog(actorId, "timer_set", { timer_seconds: result.timer_seconds });
  }
  return result;
}

export async function commissionerForcePick(competitionId, actorId, playerId) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };
  if (!playerId) return { ok: false, code: "INVALID", message: "Pick a player." };

  const ctx = await loadDraftContext(competitionId);
  if (!ctx || ctx.state.state !== "live") {
    return { ok: false, code: "UNAVAILABLE", message: "Draft is not live." };
  }

  const onClockId = ctx.onClock?.managerId;
  if (!onClockId) {
    return { ok: false, code: "UNAVAILABLE", message: "No one is on the clock." };
  }

  const actorManager = ctx.managers.find((m) => m.user_id === actorId);
  if (actorManager?.id === onClockId) {
    return { ok: false, code: "INVALID", message: "You are on the clock. Use Draft." };
  }

  const onClock = ctx.managers.find((m) => m.id === onClockId);
  const result = await executePick({
    competitionId,
    managerId: onClockId,
    playerId,
    rationale: "Commissioner pick. Manager away.",
  });

  if (result.ok) {
    await dbAdminLog(actorId, "force_pick", {
      player_id: playerId,
      manager_id: onClockId,
      team_name: onClock?.team_name,
      pick_number: result.pickNumber,
    });
  }

  return result;
}

export async function commissionerUndoPick(competitionId, pickNumber, actorId, reason) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };
  if (!reason?.trim()) {
    return { ok: false, code: "INVALID", message: "Type a reason." };
  }

  const db = getUltimaDb();
  const { data: pick } = await db
    .from("ultima_draft_picks")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("pick_number", pickNumber)
    .maybeSingle();

  if (!pick) return { ok: false, code: "UNAVAILABLE", message: "No pick at that number." };

  const { data: actorManager } = await db
    .from("ultima_managers")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("user_id", actorId)
    .maybeSingle();

  if (actorManager && pick.manager_id === actorManager.id) {
    return { ok: false, code: "INVALID", message: "You cannot undo your own pick." };
  }

  await db.from("ultima_rosters").delete().eq("manager_id", pick.manager_id).eq("player_id", pick.player_id);
  await db.from("ultima_draft_picks").delete().eq("id", pick.id);
  await db
    .from("ultima_players")
    .update({ draft_round: null, bolt_eligible: false })
    .eq("id", pick.player_id);

  await db
    .from("ultima_draft_state")
    .update({ current_pick: pickNumber, state: "live" })
    .eq("competition_id", competitionId);

  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action: "pick_undone",
    reason,
    payload: { pick_number: pickNumber, player_id: pick.player_id },
  });

  publishUltimaEvent("draft.state", { state: "live", undone: pickNumber });
  return { ok: true };
}

export async function commissionerCancelDraft(competitionId, actorId, reason, leagueNameConfirm) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const db = getUltimaDb();
  const { data: comp } = await db.from("ultima_competition").select("season_label").eq("id", competitionId).maybeSingle();
  if (leagueNameConfirm !== comp?.season_label) {
    return { ok: false, code: "UNAVAILABLE", message: "Type the season label to confirm." };
  }

  await db.from("ultima_draft_picks").delete().eq("competition_id", competitionId);
  await db
    .from("ultima_draft_state")
    .update({ state: "cancelled", current_pick: 1, draft_order: [] })
    .eq("competition_id", competitionId);

  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action: "draft_cancelled",
    reason,
    payload: {},
  });

  publishUltimaEvent("draft.state", { state: "cancelled" });
  return { ok: true };
}

export async function commissionerScoreOverride({
  managerId,
  gameweekId,
  actorId,
  reason,
  afterPoints,
  afterBolt,
}) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };
  if (!managerId || !gameweekId) {
    return { ok: false, code: "INVALID", message: "Choose a manager and gameweek." };
  }
  if (!reason?.trim()) {
    return { ok: false, code: "INVALID", message: "Type a reason." };
  }
  if (!Number.isFinite(afterPoints) || !Number.isFinite(afterBolt)) {
    return { ok: false, code: "INVALID", message: "Enter points and Bolt points." };
  }

  const db = getUltimaDb();
  const { data: before } = await db
    .from("ultima_manager_gameweek_scores")
    .select("*")
    .eq("manager_id", managerId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();

  await db.from("ultima_manager_gameweek_scores").upsert(
    {
      manager_id: managerId,
      gameweek_id: gameweekId,
      points: afterPoints,
      bolt_points: afterBolt,
      version: (before?.version ?? 0) + 1,
    },
    { onConflict: "manager_id,gameweek_id" },
  );

  await db.from("ultima_score_adjustments").insert({
    manager_id: managerId,
    gameweek_id: gameweekId,
    actor_id: actorId,
    reason,
    before_json: before ?? {},
    after_json: { points: afterPoints, bolt_points: afterBolt },
  });

  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action: "score_override",
    reason,
    payload: { manager_id: managerId, gameweek_id: gameweekId },
  });

  publishUltimaEvent("score.update", { manager_id: managerId, gameweek_id: gameweekId });
  return { ok: true };
}

export async function commissionerIssueInvite(competitionId, actorId, code) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const db = getUltimaDb();
  const expires = new Date(Date.now() + 14 * 86400_000).toISOString();

  const { error } = await db.from("ultima_invites").insert({
    code: code.toUpperCase(),
    competition_id: competitionId,
    expires_at: expires,
    created_by: actorId,
  });

  if (error) return { ok: false, error: error.message };

  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action: "invite_issued",
    payload: { code },
  });

  return { ok: true, code, expires };
}

export async function commissionerBootstrap(competitionId, actorId) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  await syncPlayerPool();
  const gw = await bootstrapSampleGameweek(competitionId);
  if (gw.ok && gw.gameweekId) {
    await recomputeGameweekScores(competitionId, gw.gameweekId);
  }

  await dbAdminLog(actorId, "bootstrap", { gameweek: gw });
  return { ok: true, ...gw };
}

export async function commissionerScheduleDraft(competitionId, actorId, scheduledAt) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const db = getUltimaDb();
  const at = scheduledAt ? new Date(scheduledAt).toISOString() : null;
  if (!at || Number.isNaN(new Date(at).getTime())) {
    return { ok: false, code: "INVALID", message: "Invalid schedule time." };
  }

  await db
    .from("ultima_draft_state")
    .update({ scheduled_at: at })
    .eq("competition_id", competitionId);

  await dbAdminLog(actorId, "draft_scheduled", { scheduled_at: at });
  return { ok: true, scheduledAt: at };
}

export async function commissionerSyncGameweek(competitionId, actorId) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const gameweek = await getActiveGameweek(competitionId);
  if (!gameweek) return { ok: false, code: "UNAVAILABLE", message: "No active gameweek." };

  const result = await runGameweekSync(competitionId, gameweek);
  await dbAdminLog(actorId, "gameweek_sync", { gameweek_id: gameweek.id, result });
  return { ok: true, ...result, gameweekId: gameweek.id };
}

export async function commissionerCreateGameweek(competitionId, actorId, payload) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const number = Number(payload.number);
  if (!Number.isInteger(number) || number < 1) {
    return { ok: false, code: "INVALID", message: "Enter a gameweek number." };
  }
  if (!payload.window_start || !payload.window_end) {
    return { ok: false, code: "INVALID", message: "Set the Friday to Thursday window." };
  }

  const result = await createGameweek({
    competitionId,
    number,
    windowStart: payload.window_start,
    windowEnd: payload.window_end,
    leagueOpenAt: payload.league_open_at ?? {},
  });

  if (result.ok) {
    await syncFixturesForGameweek({
      id: result.gameweekId,
      window_start: payload.window_start,
      window_end: payload.window_end,
    });
    await dbAdminLog(actorId, "gameweek_created", { gameweek_id: result.gameweekId });
  }

  return result;
}

export async function commissionerSyncFixtures(competitionId, actorId, gameweekId) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const db = getUltimaDb();
  const { data: gameweek } = await db
    .from("ultima_gameweeks")
    .select("*")
    .eq("id", gameweekId)
    .maybeSingle();

  if (!gameweek) return { ok: false, code: "UNAVAILABLE" };

  const result = await syncFixturesForGameweek(gameweek);
  await dbAdminLog(actorId, "fixtures_sync", { gameweek_id: gameweekId, result });
  return result;
}

export async function commissionerSyncStats(competitionId, actorId, gameweekId) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const stats = await syncStatsForGameweek(gameweekId);
  await recomputeGameweekScores(competitionId, gameweekId);
  await dbAdminLog(actorId, "stats_sync", { gameweek_id: gameweekId, stats });
  return stats;
}

async function dbAdminLog(actorId, action, payload) {
  const db = getUltimaDb();
  await db.from("ultima_admin_log").insert({
    actor_id: actorId,
    action,
    payload,
  });
}

export async function getAdminLog(limit = 50) {
  const db = getUltimaDb();
  const { data } = await db
    .from("ultima_admin_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const HUB_STATUS_FALLBACK = {
  draft: "lobby",
  market: "Free agents after the draft.",
  trades: "Trades open at gameweek 4.",
  standings: "Season table and Bolt board.",
};

export async function getHubStatus(competitionId, managerId) {
  const db = getUltimaDb();
  if (!db || !competitionId || !managerId) return { ...HUB_STATUS_FALLBACK };

  try {
    const ctx = await loadDraftContext(competitionId);

    const { count: faCount } = await db
      .from("ultima_players")
      .select("id", { count: "exact", head: true })
      .eq("active", true);

    const { data: rostered } = await db.from("ultima_rosters").select("player_id");
    const freeAgents = (faCount ?? 0) - (rostered?.length ?? 0);

    const { count: tradeCount } = await db
      .from("ultima_trades")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId)
      .eq("state", "proposed")
      .eq("receiver_id", managerId);

    const standings = await import("@/lib/ultima/server/scoring-run").then((m) =>
      m.getStandings(competitionId),
    );
    const myRow = (standings ?? []).find((s) => s.id === managerId);

    return {
      draft: ctx?.state?.state ?? "lobby",
      market: `${Math.max(0, freeAgents)} free agents.`,
      trades:
        tradeCount > 0
          ? `${tradeCount} proposal waiting.`
          : "Trades open at gameweek 4.",
      standings: myRow
        ? `You are ${myRow.rank}${ordinal(myRow.rank)}. ${myRow.seasonPoints} points.`
        : "Season table and Bolt board.",
    };
  } catch {
    return { ...HUB_STATUS_FALLBACK };
  }
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
