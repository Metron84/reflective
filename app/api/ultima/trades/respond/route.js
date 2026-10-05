import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { cancelTrade, respondToTrade, vetoTrade } from "@/lib/ultima/server/trades";
import { runWrite } from "@/lib/ultima/server/write-route";
import { otherTeamOfTrade } from "@/lib/ultima/server/receipt-names";
import {
  offerAcceptedReceipt,
  offerCancelledReceipt,
  offerDeclinedReceipt,
  vetoReceipt,
} from "@/lib/ultima/receipts";

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

  return runWrite({
    route: `trades/${kind}`,
    request,
    manager,
    handler: async () => {
      const managerId = manager.id;
      const result =
        kind === "cancel"
          ? await cancelTrade({ tradeId, managerId })
          : kind === "veto"
            ? await vetoTrade({ tradeId, managerId })
            : await respondToTrade({ tradeId, managerId, accept: kind === "accept" });

      if (!result.ok) {
        const { status, body: err } = ultimaErrorResponse(result.code, {
          message: result.message,
        });
        return { status, body: err };
      }

      const team = kind === "veto" ? null : await otherTeamOfTrade(tradeId, managerId);
      const receipt =
        kind === "cancel"
          ? offerCancelledReceipt({ team })
          : kind === "veto"
            ? vetoReceipt({ vetoed: result.vetoed, votes: result.votes })
            : kind === "accept"
              ? offerAcceptedReceipt({ team })
              : offerDeclinedReceipt({ team });
      return { status: 200, body: { ok: true, ...result, receipt } };
    },
  });
}
