import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getManagerForUser } from "@/lib/ultima/server/db";
import {
  createPracticeRoom,
  joinPracticeRoom,
  listPracticeLobby,
  normalizeRoomCode,
  resetPracticeRoom,
  startPracticeRoom,
} from "@/lib/ultima/server/practice";

export const runtime = "nodejs";

async function requireSeasonManager(user) {
  const manager = await getManagerForUser(user.id);
  if (!manager?.profile_complete) {
    return { error: ultimaErrorResponse("PROFILE_INCOMPLETE") };
  }
  return { manager };
}

export async function GET(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const gated = await requireSeasonManager(user);
  if (gated.error) return NextResponse.json(gated.error.body, { status: gated.error.status });

  const code = normalizeRoomCode(request.nextUrl.searchParams.get("code"));
  if (!code) {
    return NextResponse.json({ code: "INVALID", message: "Room code required." }, { status: 400 });
  }

  const lobby = await listPracticeLobby(code);
  if (!lobby) {
    const { status, body } = ultimaErrorResponse("INVITE_INVALID");
    return NextResponse.json(body, { status });
  }

  return NextResponse.json({
    ...lobby,
    is_host: lobby.hostUserId === user.id,
  });
}

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const gated = await requireSeasonManager(user);
  if (gated.error) return NextResponse.json(gated.error.body, { status: gated.error.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const action = body?.action;
  let result;

  switch (action) {
    case "create_solo":
      result = await createPracticeRoom({
        userId: user.id,
        seasonManager: gated.manager,
        solo: true,
      });
      break;
    case "create_room":
      result = await createPracticeRoom({
        userId: user.id,
        seasonManager: gated.manager,
        solo: false,
      });
      break;
    case "join":
      result = await joinPracticeRoom({
        userId: user.id,
        seasonManager: gated.manager,
        code: body.code,
      });
      break;
    case "start":
      result = await startPracticeRoom({ userId: user.id, code: body.code });
      break;
    case "reset":
      result = await resetPracticeRoom({ userId: user.id, code: body.code });
      break;
    default:
      return NextResponse.json({ code: "INVALID", message: "Unknown action." }, { status: 400 });
  }

  if (!result?.ok) {
    const { status, body: err } = ultimaErrorResponse(result?.code ?? "UNAVAILABLE", {
      status: result?.code === "LEAGUE_FULL" ? 403 : 400,
    });
    return NextResponse.json(
      { ...err, message: result?.message ?? err.message },
      { status },
    );
  }

  return NextResponse.json(result);
}
