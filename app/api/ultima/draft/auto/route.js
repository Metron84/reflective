import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { ultimaErrorResponse } from "@/lib/ultima/errors";
import { getManagerForUser } from "@/lib/ultima/server/db";
import { setAutoDraft } from "@/lib/ultima/server/draft";

export const runtime = "nodejs";

export async function POST(request) {
  const user = await getSessionUser();
  if (!user) {
    const { status, body } = ultimaErrorResponse("SIGN_IN_REQUIRED", { status: 401 });
    return NextResponse.json(body, { status });
  }

  const manager = await getManagerForUser(user.id);
  if (!manager?.profile_complete) {
    const { status, body } = ultimaErrorResponse("PROFILE_INCOMPLETE");
    return NextResponse.json(body, { status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: "INVALID", message: "Invalid request." }, { status: 400 });
  }

  const result = await setAutoDraft(manager.id, Boolean(body?.enabled));
  if (!result.ok) {
    const { status, body: err } = ultimaErrorResponse(result.code ?? "UNAVAILABLE", {
      message: result.message,
    });
    return NextResponse.json(err, { status });
  }

  return NextResponse.json(result);
}
