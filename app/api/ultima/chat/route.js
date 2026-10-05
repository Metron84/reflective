import { NextResponse } from "next/server";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { requireSeatApi } from "@/lib/ultima/server/requireSeat";
import { chatRateLimited, listChatMessages, postChatMessage } from "@/lib/ultima/server/chat";

export const runtime = "nodejs";

async function requireSeasonManager(mutating) {
  const gate = await requireSeatApi({ mutating });
  if (!gate.ok) return { error: gate.response };
  return { manager: gate.manager };
}

export async function GET() {
  const gated = await requireSeasonManager(false);
  if (gated.error) return gated.error;

  const messages = await listChatMessages(gated.manager.competition_id);
  return NextResponse.json({ messages });
}

export async function POST(request) {
  const gated = await requireSeasonManager(true);
  if (gated.error) return gated.error;

  if (chatRateLimited(gated.manager.id)) {
    return NextResponse.json(
      { code: "RATE_LIMIT", message: "Too many messages. Wait a moment." },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const result = await postChatMessage({
    competitionId: gated.manager.competition_id,
    managerId: gated.manager.id,
    body: body?.body,
  });

  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code ?? "UNAVAILABLE");
    return NextResponse.json({ ...err, message: result.message ?? err.message }, { status });
  }

  // The message is saved. If the re-read fails, say so instead of an empty list.
  let messages = null;
  try {
    messages = await listChatMessages(gated.manager.competition_id);
  } catch {
    messages = null;
  }
  return NextResponse.json({ ok: true, messages });
}
