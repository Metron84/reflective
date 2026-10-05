import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { addDropTransaction } from "@/lib/ultima/server/market";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { runIdempotent } from "@/lib/ultima/server/action-keys";
import { signReceipt } from "@/lib/ultima/receipts";

export const runtime = "nodejs";

const rateMap = new Map();

function rateLimited(managerId) {
  const now = Date.now();
  const hits = (rateMap.get(managerId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  rateMap.set(managerId, hits);
  return hits.length > 10;
}

export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { manager } = gate;
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  if (rateLimited(manager.id)) {
    return NextResponse.json(
      { code: "RATE_LIMIT", message: "Too many moves. Wait a moment." },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  return runIdempotent({
    request,
    route: "market/transaction",
    managerId: manager.id,
    handler: async () => {
      const competition = await getActiveCompetition();
      const gameweek = competition ? await getCurrentGameweek(competition.id) : null;

      const result = await addDropTransaction({
        managerId: manager.id,
        addPlayerId: body?.add_player_id,
        dropPlayerId: body?.drop_player_id,
        gameweekId: gameweek?.id,
        gameweek,
      });

      if (!result.ok) {
        const { status, body: err } = ultimaErrorResponse(result.code, {
          message: result.message,
        });
        return { status, body: err };
      }

      return {
        status: 200,
        body: { ok: true, receipt: signReceipt({ added: result.added, dropped: result.dropped }) },
      };
    },
  });
}
