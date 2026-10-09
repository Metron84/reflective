import { NextResponse } from "next/server";
import { QUESTIONS } from "@/lib/observatory/footballer-001";
import { observatoryLimited } from "@/lib/observatory/rate-limit";
import { loadAnswers, loadResponse, optionFor, questionPayload, studyDb } from "@/lib/observatory/store";

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
    const step = body?.step;
    const questionId = typeof body?.questionId === "string" ? body.questionId : "";
    const optionId = typeof body?.optionId === "string" ? body.optionId : "";
    const shownPosition = body?.shownPosition;
    if (!UUID.test(sessionId)) return fail("That session is not valid.");
    if (!Number.isInteger(step) || step < 1 || step > 6) return fail("That step is not valid.");
    if (![1, 2, 3].includes(shownPosition)) return fail("That position is not valid.");

    const client = studyDb();
    if (!client) return fail("The study is warming up. Try again soon.", 503);

    const row = await loadResponse(client, sessionId);
    if (!row) return fail("No study found.", 404);
    if (row.completed_at) return fail("This study is already finished.", 409);

    const { error: dropped } = await client
      .from("study_answers")
      .delete()
      .eq("response_id", row.id)
      .gte("step", step);
    if (dropped) throw dropped;

    const remaining = await loadAnswers(client, row.id);
    const expected = remaining.length + 1 === step ? questionPayload(remaining) : null;
    const option = optionFor(questionId, optionId);
    if (!expected || expected.questionId !== questionId || !option) {
      return fail("That answer does not fit this step.");
    }

    const { error: inserted } = await client.from("study_answers").insert({
      response_id: row.id,
      step,
      question_id: questionId,
      option_id: optionId,
      shown_position: shownPosition,
    });
    if (inserted) throw inserted;

    const patch = {};
    if (step === 1 && option.go) patch.branch = option.go;
    if (step === 6) patch.leader_after_core = QUESTIONS[questionId]?.lead ?? null;
    if (Object.keys(patch).length) {
      const { error: saved } = await client.from("study_responses").update(patch).eq("id", row.id);
      if (saved) throw saved;
    }

    const answers = await loadAnswers(client, row.id);
    if (answers.length >= 6) return NextResponse.json({ status: "about" });
    const question = questionPayload(answers);
    if (!question) return fail("This study cannot continue.");
    return NextResponse.json({ status: "question", question });
  } catch (error) {
    console.error("observatory/answer", error);
    return fail("Something went wrong. Try again.", 500);
  }
}
