import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { respondToTrade, vetoTrade } from "@/lib/ultima/server/trades";

export const runtime = "nodejs";

export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { user, manager } = gate;
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

  if (body?.veto) {
    const result = await vetoTrade({ tradeId, managerId: manager.id });
    if (!result.ok) {
      const { status, body: err } = ultimaErrorResponse(result.code, {
        message: result.message,
      });
      return NextResponse.json(err, { status });
    }
    return NextResponse.json({ ok: true, ...result });
  }

  const result = await respondToTrade({
    tradeId,
    managerId: manager.id,
    accept: Boolean(body?.accept),
  });

  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code, {
      message: result.message,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json({ ok: true, ...result });
}
