import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { upsertCodemasterSolve } from "@/lib/codemaster/server-progress";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "sign-in-required" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { puzzleId, score, hints, attribution } = body ?? {};
  if (
    typeof puzzleId !== "string" ||
    puzzleId.length > 64 ||
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 500 ||
    typeof hints !== "number" ||
    !Number.isFinite(hints) ||
    hints < 0 ||
    hints > 200 ||
    typeof attribution !== "boolean"
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await upsertCodemasterSolve(user.id, puzzleId, {
    score: Math.round(score),
    hints: Math.round(hints),
    attribution,
    solvedAt: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
