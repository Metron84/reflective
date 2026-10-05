import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getCurrentGameweek } from "@/lib/ultima/server/bootstrap";
import { setCaptain } from "@/lib/ultima/server/lineup";
import { recomputeGameweekScores } from "@/lib/ultima/server/scoring-run";
import { runWrite } from "@/lib/ultima/server/write-route";
import { playerNameOf } from "@/lib/ultima/server/receipt-names";
import { captainReceipt } from "@/lib/ultima/receipts";

export const runtime = "nodejs";

const STATUS = {
  NOT_IN_XV: 400,
  CAPTAIN_LOCKED: 409,
  NO_GAMEWEEK: 400,
  CAPTAIN_UNAVAILABLE: 503,
};

/** Make a player his country's captain. One tap, replaces the old captain. */
export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { manager, competition } = gate;

  return runWrite({
    route: "lineup/captain",
    request,
    manager,
    handler: async () => {
      let body;
      try {
        body = await request.json();
      } catch {
        return { status: 400, body: { code: "INVALID", message: "Invalid request." } };
      }
      const playerId = typeof body?.player_id === "string" ? body.player_id : "";
      if (!playerId) {
        return { status: 400, body: { code: "INVALID", message: "Pick a player." } };
      }

      const gameweek = competition ? await getCurrentGameweek(competition.id) : null;
      if (!gameweek) {
        const { status, body: err } = ultimaErrorResponse("NO_GAMEWEEK", { status: STATUS.NO_GAMEWEEK });
        return { status, body: err };
      }

      const result = await setCaptain({
        managerId: manager.id,
        gameweekId: gameweek.id,
        gameweek,
        playerId,
      });
      if (!result.ok) {
        const { status, body: err } = ultimaErrorResponse(result.code, {
          status: STATUS[result.code] ?? 400,
        });
        return { status, body: err };
      }

      await recomputeGameweekScores(competition.id, gameweek.id);

      return {
        status: 200,
        body: {
          ok: true,
          captains: result.captains,
          receipt: captainReceipt({ player: await playerNameOf(playerId) }),
        },
      };
    },
  });
}
