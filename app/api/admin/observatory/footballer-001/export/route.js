import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { ORDER, STUDY_SLUG, findOption } from "@/lib/observatory/footballer-001";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

function cell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function csv(rows) {
  return rows.map((row) => row.map(cell).join(",")).join("\n");
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request) {
  const gate = await requireAdminApi();
  if (!gate.ok) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const file = new URL(request.url).searchParams.get("file");
  const client = getServiceClient();
  if (!client) {
    return NextResponse.json({ error: "The study store is not connected." }, { status: 503 });
  }

  if (file === "responses") {
    const { data, error } = await client.from("study_results_v").select("*").eq("study_slug", STUDY_SLUG);
    if (error) return NextResponse.json({ error: "Could not export responses." }, { status: 500 });
    const base = [
      "id", "study_slug", "study_version", "locale", "branch", "leader_after_core",
      "primary_archetype", "secondary_archetype", "scores", "perception", "perception_matches",
      "club", "age_bracket", "ted_lasso", "started_at", "completed_at", "seconds_taken",
      ...ORDER.map((key) => `score_${key}`),
    ];
    const lines = [base];
    for (const row of data ?? []) {
      const scores = row.scores && typeof row.scores === "object" ? row.scores : {};
      lines.push([
        row.id, row.study_slug, row.study_version, row.locale, row.branch, row.leader_after_core,
        row.primary_archetype, row.secondary_archetype,
        JSON.stringify(scores),
        row.perception, row.perception_matches, row.club, row.age_bracket, row.ted_lasso,
        row.started_at, row.completed_at, row.seconds_taken,
        ...ORDER.map((key) => scores[key] ?? 0),
      ]);
    }
    return new NextResponse(csv(lines), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="footballer-001-responses-${stamp()}.csv"`,
      },
    });
  }

  if (file === "answers") {
    const { data, error } = await client
      .from("study_answers")
      .select("response_id, step, question_id, option_id, shown_position, answered_at, study_responses!inner(study_slug)")
      .eq("study_responses.study_slug", STUDY_SLUG)
      .order("response_id", { ascending: true })
      .order("step", { ascending: true });
    if (error) return NextResponse.json({ error: "Could not export answers." }, { status: 500 });
    const lines = [["response_id", "step", "question_id", "option_id", "option_text", "shown_position", "answered_at"]];
    for (const row of data ?? []) {
      const option = findOption(row.question_id, row.option_id);
      lines.push([
        row.response_id, row.step, row.question_id, row.option_id,
        option?.text ?? "", row.shown_position, row.answered_at,
      ]);
    }
    return new NextResponse(csv(lines), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="footballer-001-answers-${stamp()}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Choose responses or answers." }, { status: 400 });
}
