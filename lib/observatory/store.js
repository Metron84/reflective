import "server-only";
import { getServiceClient } from "@/lib/supabase";
import {
  STUDY_SLUG,
  STUDY_VERSION,
  buildResult,
  expectedQuestionId,
  findOption,
  publicQuestion,
} from "./footballer-001";

export function studyDb() {
  return getServiceClient();
}

export async function loadResponse(client, sessionId) {
  const { data, error } = await client
    .from("study_responses")
    .select("*")
    .eq("study_slug", STUDY_SLUG)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadAnswers(client, responseId) {
  const { data, error } = await client
    .from("study_answers")
    .select("step, question_id, option_id, shown_position")
    .eq("response_id", responseId)
    .order("step", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    step: row.step,
    questionId: row.question_id,
    optionId: row.option_id,
    shownPosition: row.shown_position,
  }));
}

export function questionPayload(answers) {
  const questionId = expectedQuestionId(answers);
  if (!questionId) return null;
  return publicQuestion(questionId, answers.length + 1);
}

export function resultPayload(answers, perception) {
  return { status: "complete", result: buildResult(answers, perception) };
}

export async function openStudy(client, sessionId, locale) {
  const { data, error } = await client
    .from("study_responses")
    .upsert(
      {
        study_slug: STUDY_SLUG,
        study_version: STUDY_VERSION,
        session_id: sessionId,
        consent: true,
        locale,
      },
      { onConflict: "study_slug,session_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function optionFor(questionId, optionId) {
  return findOption(questionId, optionId);
}
