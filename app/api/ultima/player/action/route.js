import { NextResponse } from "next/server";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { runCardAction } from "@/lib/ultima/server/player-card";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { runIdempotent } from "@/lib/ultima/server/action-keys";
import { playerNameFor } from "@/lib/ultima/server/receipt-data";
import { cardActionReceipt } from "@/lib/ultima/receipts";

export const runtime = "nodejs";

const STATUS = {
  PICK_TAKEN: 409,
  IN_ACCEPTED_TRADE: 409,
  XV_LOCKED: 409,
  CAPTAIN_LOCKED: 409,
  FLOOR_VIOLATION: 409,
  SQUAD_FULL: 409,
  UNTOUCHABLE_LIMIT: 409,
  NOT_OWNED: 403,
  UNAVAILABLE: 503,
};

const rateMap = new Map();
function rateLimited(managerId) {
  const now = Date.now();
  const hits = (rateMap.get(managerId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  rateMap.set(managerId, hits);
  return hits.length > 30;
}

/** One card action. Writes confirm the user with the Auth server first. */
export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { manager, competition } = gate;

  if (rateLimited(manager.id)) {
    return NextResponse.json({ code: "RATE_LIMIT", message: "Too many moves. Wait a moment." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const playerId = typeof body?.player_id === "string" ? body.player_id : "";
  const action = typeof body?.action === "string" ? body.action : "";

  return runIdempotent({
    request,
    route: "player/action",
    managerId: manager.id,
    competitionId: gate.competition?.id ?? manager.competition_id,
    handler: async () => {
      const result = await runCardAction({
        competition,
        manager,
        playerId,
        action,
        note: body?.note,
        otherPlayerId: typeof body?.other_player_id === "string" ? body.other_player_id : null,
      });

      if (!result.ok) {
        const { status, body: err } = ultimaErrorResponse(result.code, {
          status: STATUS[result.code] ?? 400,
          message: result.message,
        });
        return { status, body: err };
      }
      const name = await playerNameFor(playerId);
      return { status: 200, body: { ok: true, receipt: cardActionReceipt({ action, name, result }) } };
    },
  });
}
