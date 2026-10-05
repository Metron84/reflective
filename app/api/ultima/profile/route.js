import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import {
  ULTIMA_COLOUR_PALETTE,
  normalizeNotifyPrefs,
} from "@/lib/ultima/constants";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";
import { getLoggedDb } from "@/lib/ultima/server/strict-db";

export const runtime = "nodejs";

const COLOUR_IDS = new Set(ULTIMA_COLOUR_PALETTE.map((c) => c.id));

function cleanTeamName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 24) return null;
  if (/https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function cleanManagerName(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 48) return null;
  return trimmed;
}

export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { user, manager } = gate;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID", message: "Invalid request." },
      { status: 400 },
    );
  }

  const teamName = cleanTeamName(payload?.team_name);
  const managerName = cleanManagerName(payload?.manager_name);
  const colour =
    typeof payload?.colour === "string" && COLOUR_IDS.has(payload.colour)
      ? payload.colour
      : null;
  const notifyPrefs = normalizeNotifyPrefs(payload?.notify_prefs);

  if (!teamName || !managerName || !colour) {
    return NextResponse.json(
      {
        code: "INVALID",
        message: "Team name, manager name and colour are required.",
        field: "team_name",
      },
      { status: 400 },
    );
  }

  const db = getLoggedDb("route:ultima/profile");
  if (!db) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(body, { status });
  }

  const patch = {
    team_name: teamName,
    manager_name: managerName,
    colour,
    profile_complete: true,
    notify_prefs: notifyPrefs,
  };

  let { error } = await db
    .from("ultima_managers")
    .update(patch)
    .eq("id", manager.id)
    .eq("user_id", user.id);

  if (error && /notify_prefs/i.test(error.message ?? "")) {
    delete patch.notify_prefs;
    ({ error } = await db
      .from("ultima_managers")
      .update(patch)
      .eq("id", manager.id)
      .eq("user_id", user.id));
  }

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          code: "DUPLICATE",
          message: "That team name is taken. Choose another.",
          field: "team_name",
        },
        { status: 409 },
      );
    }
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 500 });
    return NextResponse.json(body, { status });
  }

  await recordUltimaEvent({
    event: "profile_saved",
    managerId: manager.id,
    competitionId: manager.competition_id,
    payload: { team_name: teamName, colour },
  });

  return NextResponse.json({ ok: true });
}
