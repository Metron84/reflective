import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getManagerForUser } from "@/lib/ultima/server/db";
import { chatRateLimited, listChatMessages, postChatMessage } from "@/lib/ultima/server/chat";

export const runtime = "nodejs";

async function requireSeasonManager() {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return { error: NextResponse.json(body, { status }) };
  }
  const manager = await getManagerForUser(user.id);
  if (!manager) {
    const { status, body } = ultimaErrorResponse("UNAVAILABLE", { status: 403 });
    return { error: NextResponse.json(body, { status }) };
  }
  return { manager };
}

export async function GET() {
  const gated = await requireSeasonManager();
  if (gated.error) return gated.error;

  const messages = await listChatMessages(gated.manager.competition_id);
  return NextResponse.json({ messages });
}

export async function POST(request) {
  const gated = await requireSeasonManager();
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

  const messages = await listChatMessages(gated.manager.competition_id);
  return NextResponse.json({ ok: true, messages });
}
