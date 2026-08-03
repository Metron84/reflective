import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  clearUserCodemasterProgress,
  emptyProgress,
  loadUserCodemasterProgress,
  mergeProgressMaps,
  upsertCodemasterProgress,
} from "@/lib/codemaster/server-progress";

export const runtime = "nodejs";

function isProgressShape(value) {
  return (
    value &&
    typeof value === "object" &&
    value.solved &&
    typeof value.solved === "object"
  );
}

/** Load cloud progress and optionally merge browser-local solves upward. */
export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: true, signedIn: false, progress: null });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const local = isProgressShape(body?.local) ? body.local : emptyProgress();
  const cloud = await loadUserCodemasterProgress(user.id);
  const merged = mergeProgressMaps(cloud, local);

  await upsertCodemasterProgress(user.id, merged);
  const progress = await loadUserCodemasterProgress(user.id);

  return NextResponse.json({ ok: true, signedIn: true, progress });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: true, signedIn: false, progress: null });
  }
  const progress = await loadUserCodemasterProgress(user.id);
  return NextResponse.json({ ok: true, signedIn: true, progress });
}

/** Clear account progress (journey reset). */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "sign-in-required" }, { status: 401 });
  }
  await clearUserCodemasterProgress(user.id);
  return NextResponse.json({ ok: true, signedIn: true, progress: emptyProgress() });
}
