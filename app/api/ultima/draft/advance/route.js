import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition, getManagerForUser } from "@/lib/ultima/server/db";
import { advanceDraft } from "@/lib/ultima/server/draft";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST() {
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
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(err, { status });
  }

  try {
    const result = await advanceDraft(competition.id);
    if (result?.ok === false) {
      return NextResponse.json(
        {
          ok: false,
          code: result.code ?? "BOT_PICK_FAILED",
          message: result.message ?? "Advance failed.",
          competition_id: competition.id,
          current_pick: result.current_pick ?? null,
          on_clock_is_bot: result.on_clock_is_bot ?? null,
        },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Ultima draft advance threw", {
      competition_id: competition.id,
      message: err?.message ?? String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        code: "BOT_PICK_FAILED",
        message: err?.message ?? "Advance threw.",
        competition_id: competition.id,
      },
      { status: 500 },
    );
  }
}
