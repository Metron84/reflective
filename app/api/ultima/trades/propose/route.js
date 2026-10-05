import { NextResponse } from "next/server";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getActiveCompetition } from "@/lib/ultima/server/db";
import { proposeTrade, previewTradeVerdict } from "@/lib/ultima/server/trades";

export const runtime = "nodejs";

export async function POST(request) {
  const gate = await requireSeatApi({ mutating: true });
  if (!gate.ok) return gate.response;
  const { manager } = gate;
  if (!manager || manager.is_bot) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const competition = await getActiveCompetition();
  if (!competition) {
    const { status, body: err } = ultimaErrorResponse("UNAVAILABLE", { status: 503 });
    return NextResponse.json(err, { status });
  }

  if (body?.preview) {
    const preview = await previewTradeVerdict({
      competitionId: competition.id,
      proposerId: manager.id,
      receiverId: body.receiver_id,
      givePlayerIds: body.give_player_ids ?? [],
      getPlayerIds: body.get_player_ids ?? [],
      counterOf: body.counter_of ?? null,
    });
    if (!preview.ok) {
      const { status, body: err } = ultimaErrorResponse(preview.code, {
        message: preview.message,
      });
      return NextResponse.json(err, { status });
    }
    return NextResponse.json({ ok: true, verdict: preview.verdict });
  }

  const result = await proposeTrade({
    competitionId: competition.id,
    proposerId: manager.id,
    receiverId: body?.receiver_id,
    givePlayerIds: body?.give_player_ids ?? [],
    getPlayerIds: body?.get_player_ids ?? [],
    counterOf: body?.counter_of ?? null,
  });

  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code, {
      message: result.message,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json({ ok: true, trade_id: result.tradeId, verdict: result.verdict });
}
