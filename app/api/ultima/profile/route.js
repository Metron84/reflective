import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ULTIMA_COLOUR_PALETTE } from "@/lib/ultima/constants";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getManagerForUser, getUltimaDb } from "@/lib/ultima/server/db";
import { recordUltimaEvent } from "@/lib/ultima/server/record-event";

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
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", {
      status: 401,
    });
    return NextResponse.json(body, { status });
  }

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

  const db = getUltimaDb();
  if (!db) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(body, { status });
  }

  const manager = await getManagerForUser(user.id);
  if (!manager) {
    const { status, body } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(body, { status });
  }

  const { error } = await db
    .from("ultima_managers")
    .update({
      team_name: teamName,
      manager_name: managerName,
      colour,
      profile_complete: true,
    })
    .eq("id", manager.id)
    .eq("user_id", user.id);

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
