import { publishUltimaEvent } from "@/lib/ultima/server/events";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { isCommissionerUser } from "@/lib/ultima/server/db";
import {
  startDraft,
  pauseDraft,
  resumeDraft,
  loadDraftContext,
} from "@/lib/ultima/server/draft";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { syncPlayerPool } from "@/lib/ultima/server/players";
import { bootstrapSampleGameweek } from "@/lib/ultima/server/bootstrap";

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

export async function commissionerUndoPick(competitionId, pickNumber, actorId, reason) {
  if (!(await requireCommissioner(actorId))) return { ok: false, code: "NOT_COMMISSIONER" };

  const db = getUltimaDb();
  const { data: pick } = await db
    .from("ultima_draft_picks")
    .select("*")
    .eq("competition_id", competitionId)
    .eq("pick_number", pickNumber)
    .maybeSingle();

  if (!pick) return { ok: false, code: "UNAVAILABLE" };

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

export async function getHubStatus(competitionId, managerId) {
  const db = getUltimaDb();
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
  const myRow = standings.find((s) => s.id === managerId);

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
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
