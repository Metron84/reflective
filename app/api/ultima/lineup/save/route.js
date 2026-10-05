import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { saveLineup } from "@/lib/ultima/server/lineup";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { runIdempotent } from "@/lib/ultima/server/action-keys";
import { lineupReceipt } from "@/lib/ultima/receipts";

export const runtime = "nodejs";

export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { manager } = gate;
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  return runIdempotent({
    request,
    route: "lineup/save",
    managerId: manager.id,
    competitionId: gate.competition?.id ?? manager.competition_id,
    handler: async () => {
      const competition = await getActiveCompetition();
      if (!competition) {
        const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
        return { status, body: err };
      }

      const gameweek = await getCurrentGameweek(competition.id);
      if (!gameweek) {
        return {
          status: 400,
          body: { code: "UNAVAILABLE", message: "No gameweek this week. The leagues are on a break." },
        };
      }

      const result = await saveLineup({
        managerId: manager.id,
        gameweekId: gameweek.id,
        slots: body?.slots ?? [],
        gameweek,
      });

      if (!result.ok) {
        const { status, body: err } = ultimaErrorResponse(result.code, {
          message: result.message,
        });
        return { status, body: err };
      }

      await recomputeGameweekScores(competition.id, gameweek.id);

      return { status: 200, body: { ok: true, receipt: lineupReceipt() } };
    },
  });
}
