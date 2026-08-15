import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getUltimaDb } from "@/lib/ultima/server/db";
import { getManagerPickCounts, loadDraftContext } from "@/lib/ultima/server/draft";
import {
  expirePracticeTurn,
  getPracticeManager,
  getPracticeRoom,
  normalizeRoomCode,
} from "@/lib/ultima/server/practice";
import {
  floorCounterState,
  formatFloorCounter,
  remainingSlots,
} from "@/lib/ultima/draft/floor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const code = normalizeRoomCode(request.nextUrl.searchParams.get("code"));
  const room = await getPracticeRoom(code);
  if (!room) {
    const { status, body } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(body, { status });
  }

  const manager = await getPracticeManager(user.id, room.competition_id);
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  await expirePracticeTurn(code);

  const ctx = await loadDraftContext(room.competition_id);
  if (!ctx) {
    return NextResponse.json({ state: "lobby", picks: [], available: [], room: code });
  }

  const db = getUltimaDb();
  const { data: queue } = await db
    .from("ultima_draft_queues")
    .select("player_id, position")
    .eq("manager_id", manager.id)
    .order("position");

  const onClockManager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
  const myCounts = await getManagerPickCounts(room.competition_id, manager.id);
  const myPickCount = ctx.picks.filter((p) => p.manager_id === manager.id).length;
  const counter = floorCounterState(myCounts, remainingSlots(myPickCount));

  let secondsRemaining = null;
  if (ctx.state.turn_expires_at && ctx.state.state === "live") {
    secondsRemaining = Math.max(
      0,
      Math.floor((new Date(ctx.state.turn_expires_at).getTime() - Date.now()) / 1000),
    );
  }

  return NextResponse.json({
    room: code,
    is_host: room.host_user_id === user.id,
    state: ctx.state.state,
    current_pick: ctx.state.current_pick,
    picks: ctx.picks.map((p) => ({
      pick_number: p.pick_number,
      round: p.round,
      manager_id: p.manager_id,
      manager_name: p.ultima_managers?.team_name,
      is_bot: p.ultima_managers?.is_bot,
      player: p.ultima_players,
      forced: p.forced,
      rationale: p.rationale,
      auto_picked: p.auto_picked,
    })),
    available: ctx.available,
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
    seconds_remaining: secondsRemaining,
    floor_counter: formatFloorCounter(counter.counts, counter.deficits, counter.slotsLeft),
    floor_mode: counter.mode,
    queue: queue ?? [],
    managers: ctx.managers.map((m) => ({
      id: m.id,
      team_name: m.team_name,
      colour: m.colour,
      is_bot: m.is_bot,
      draft_slot: m.draft_slot,
    })),
  });
}
