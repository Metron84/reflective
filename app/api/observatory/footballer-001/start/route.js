import { NextResponse } from "next/server";
import { observatoryLimited } from "@/lib/observatory/rate-limit";
import { loadAnswers, openStudy, questionPayload, resultPayload, studyDb } from "@/lib/observatory/store";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const blocked = observatoryLimited(request);
  if (blocked) return blocked;
  try {
    const body = await request.json().catch(() => null);
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!UUID.test(sessionId)) return fail("That session is not valid.");
    if (body?.consent !== true) return fail("Consent is required.");
    const locale = typeof body?.locale === "string" && body.locale.trim() ? body.locale.trim().slice(0, 12) : "en";

    const client = studyDb();
    if (!client) return fail("The study is warming up. Try again soon.", 503);

    const row = await openStudy(client, sessionId, locale);
    const answers = await loadAnswers(client, row.id);
    if (row.completed_at) return NextResponse.json(resultPayload(answers, row.perception));
    const question = questionPayload(answers);
    if (!question) return fail("This study cannot continue.");
    return NextResponse.json({ status: "question", question });
  } catch (error) {
    console.error("observatory/start", error);
    return fail("Something went wrong. Try again.", 500);
  }
}
