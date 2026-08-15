import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import {
  commissionerStartDraft,
  commissionerPauseDraft,
  commissionerResumeDraft,
  commissionerForcePick,
  commissionerUndoPick,
  commissionerCancelDraft,
  commissionerScoreOverride,
  commissionerIssueInvite,
  commissionerBootstrap,
  commissionerSetTimer,
  commissionerScheduleDraft,
  commissionerSyncGameweek,
  commissionerCreateGameweek,
  commissionerSyncFixtures,
  commissionerSyncStats,
  generateInviteCode,
  requireCommissioner,
} from "@/lib/ultima/server/admin";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  if (!(await requireCommissioner(user.id))) {
    const { status, body } = ultimaErrorResponse("NOT_COMMISSIONER", { status: 403 });
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(err, { status });
  }

  const action = body?.action;
  let result;

  switch (action) {
    case "start_draft":
      result = await commissionerStartDraft(competition.id, user.id);
      break;
    case "pause_draft":
      result = await commissionerPauseDraft(competition.id, user.id);
      break;
    case "resume_draft":
      result = await commissionerResumeDraft(
        competition.id,
        user.id,
        competition.timer_seconds ?? 60,
      );
      break;
    case "force_pick":
      result = await commissionerForcePick(competition.id, user.id, body.player_id);
      break;
    case "undo_pick":
      result = await commissionerUndoPick(
        competition.id,
        body.pick_number,
        user.id,
        body.reason,
      );
      break;
    case "cancel_draft":
      result = await commissionerCancelDraft(
        competition.id,
        user.id,
        body.reason,
        body.confirm,
      );
      break;
    case "score_override":
      result = await commissionerScoreOverride({
        managerId: body.manager_id,
        gameweekId: body.gameweek_id,
        actorId: user.id,
        reason: body.reason,
        afterPoints: Number(body.points),
        afterBolt: Number(body.bolt_points),
      });
      break;
    case "issue_invite": {
      const code = body.code ?? (await generateInviteCode());
      result = await commissionerIssueInvite(competition.id, user.id, code);
      break;
    }
    case "bootstrap":
      result = await commissionerBootstrap(competition.id, user.id);
      break;
    case "set_timer":
      result = await commissionerSetTimer(competition.id, user.id, body.timer_seconds);
      break;
    case "schedule_draft":
      result = await commissionerScheduleDraft(competition.id, user.id, body.scheduled_at);
      break;
    case "sync_gameweek":
      result = await commissionerSyncGameweek(competition.id, user.id);
      break;
    case "create_gameweek":
      result = await commissionerCreateGameweek(competition.id, user.id, body);
      break;
    case "sync_fixtures":
      result = await commissionerSyncFixtures(competition.id, user.id, body.gameweek_id);
      break;
    case "sync_stats":
      result = await commissionerSyncStats(competition.id, user.id, body.gameweek_id);
      break;
    default:
      return NextResponse.json({ code: "INVALID", message: "Unknown action." }, { status: 400 });
  }

  if (!result?.ok) {
    const { status, body: err } = ultimaErrorResponse(result?.code ?? "UNAVAILABLE", {
      message: result?.message ?? result?.error,
      status: result?.code === "NOT_COMMISSIONER" ? 403 : 400,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json(result);
}
