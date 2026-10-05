import { NextResponse } from "next/server";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { runCardAction } from "@/lib/ultima/server/player-card";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { runWrite } from "@/lib/ultima/server/write-route";

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
  ALREADY_YOURS: 409,
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

  return runWrite({
    route: "player/action",
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

      const result = await runCardAction({
        competition,
        manager,
        playerId: typeof body?.player_id === "string" ? body.player_id : "",
        action: typeof body?.action === "string" ? body.action : "",
        note: body?.note,
        otherPlayerId: typeof body?.other_player_id === "string" ? body.other_player_id : null,
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
      return { status: 200, body: { ok: true, receipt: result.receipt ?? undefined } };
    },
  });
}
