import { NextResponse } from "next/server";
import { AGE_BRACKETS, ORDER, TED_LASSO, rankArchetypes, scoreAnswers } from "@/lib/observatory/footballer-001";
import { observatoryLimited } from "@/lib/observatory/rate-limit";
import { loadAnswers, loadResponse, resultPayload, studyDb } from "@/lib/observatory/store";

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
    const perception = body?.perception ?? null;
    if (perception !== null && !ORDER.includes(perception)) return fail("That choice is not valid.");
    if (!AGE_BRACKETS.includes(body?.ageBracket)) return fail("Choose an age group.");
    if (!TED_LASSO.includes(body?.tedLasso)) return fail("Choose an answer about Ted Lasso.");
    const clubRaw = typeof body?.club === "string" ? body.club.trim().slice(0, 60) : "";

    const client = studyDb();
    if (!client) return fail("The study is warming up. Try again soon.", 503);

    const row = await loadResponse(client, sessionId);
    if (!row) return fail("No study found.", 404);
    const answers = await loadAnswers(client, row.id);
    if (answers.length !== 6) return fail("Finish the six player questions first.");

    const rank = rankArchetypes(answers);
    const { scores } = scoreAnswers(answers);
    const { error } = await client
      .from("study_responses")
      .update({
        primary_archetype: rank[0],
        secondary_archetype: rank[1],
        scores,
        perception,
        club: clubRaw || null,
        age_bracket: body.ageBracket,
        ted_lasso: body.tedLasso,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw error;

    return NextResponse.json(resultPayload(answers, perception));
  } catch (error) {
    console.error("observatory/finish", error);
    return fail("Something went wrong. Try again.", 500);
  }
}
