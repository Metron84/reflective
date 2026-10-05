import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { addDropTransaction } from "@/lib/ultima/server/market";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { runWrite } from "@/lib/ultima/server/write-route";
import { signedReceipt } from "@/lib/ultima/receipts";

export const runtime = "nodejs";

const STATUS = {
  PICK_TAKEN: 409,
  ALREADY_YOURS: 409,
  IN_ACCEPTED_TRADE: 409,
  XV_LOCKED: 409,
  SQUAD_FULL: 409,
  FLOOR_VIOLATION: 409,
  NOT_OWNED: 403,
};

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

  return runWrite({
    route: "market/transaction",
    request,
    manager,
    handler: async () => {
      if (rateLimited(manager.id)) {
        return {
          status: 429,
          body: { code: "RATE_LIMIT", message: "Too many moves. Wait a moment." },
        };
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return { status: 400, body: { code: "INVALID", message: "Invalid request." } };
      }

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
          status: STATUS[result.code] ?? 400,
          message: result.message,
        });
        return {
          status,
          body: { ...err, taken_by: result.taken_by ?? undefined, taken_at: result.taken_at ?? undefined },
        };
      }

      return {
        status: 200,
        body: { ok: true, receipt: signedReceipt({ added: result.added, dropped: result.dropped }) },
      };
    },
  });
}
