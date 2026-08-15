import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import {
  getActiveCompetition,
  getManagerForUser,
  getUltimaDb,
} from "@/lib/ultima/server/db";
import { loadDraftContext, getManagerPickCounts } from "@/lib/ultima/server/draft";
import {
  floorCounterState,
  formatFloorCounter,
  remainingSlots,
} from "@/lib/ultima/draft/floor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const manager = await getManagerForUser(user.id);
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(body, { status });
  }

  const ctx = await loadDraftContext(competition.id);
  if (!ctx) {
    return NextResponse.json({ state: "lobby", picks: [], available: [] });
  }

  const db = getUltimaDb();
  const { data: queue } = await db
    .from("ultima_draft_queues")
    .select("player_id, position")
    .eq("manager_id", manager.id)
    .order("position");

  const onClockManager = ctx.managers.find((m) => m.id === ctx.onClock?.managerId);
  const myCounts = await getManagerPickCounts(competition.id, manager.id);
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
