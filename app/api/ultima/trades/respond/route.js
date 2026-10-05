import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { cancelTrade, respondToTrade, vetoTrade } from "@/lib/ultima/server/trades";
import { runIdempotent } from "@/lib/ultima/server/action-keys";
import { tradeResponseReceipt } from "@/lib/ultima/receipts";

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

  const tradeId = body?.trade_id;
  if (!tradeId) {
    return NextResponse.json({ code: "INVALID", message: "Trade required." }, { status: 400 });
  }

  const kind = body?.cancel ? "cancel" : body?.veto ? "veto" : body?.accept ? "accept" : "decline";

  return runIdempotent({
    request,
    route: `trades/${kind}`,
    managerId: manager.id,
    competitionId: gate.competition?.id ?? manager.competition_id,
    handler: async () => {
      let result;
      if (kind === "cancel") result = await cancelTrade({ tradeId, managerId: manager.id });
      else if (kind === "veto") result = await vetoTrade({ tradeId, managerId: manager.id });
      else result = await respondToTrade({ tradeId, managerId: manager.id, accept: kind === "accept" });

      if (!result.ok) {
        const { status, body: err } = ultimaErrorResponse(result.code, {
          message: result.message,
        });
        return { status, body: err };
      }
      return {
        status: 200,
        body: {
          ok: true,
          ...result,
          receipt: tradeResponseReceipt({
            kind,
            state: result.state,
            vetoed: result.vetoed,
            votes: result.votes,
          }),
        },
      };
    },
  });
}
