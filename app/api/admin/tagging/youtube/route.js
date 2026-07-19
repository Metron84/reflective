import { NextResponse } from "next/server";
import { adminClient, badRequest } from "../_helpers";
import { fetchYoutubeVideoMeta, parseYoutubeId } from "@/lib/admin/youtube";

export const runtime = "nodejs";

export async function POST(request) {
  const { error } = await adminClient();
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request.");
  }

  const id = parseYoutubeId(body?.url ?? body?.youtubeId ?? "");
  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_url",
        message: "Couldn't fetch, enter title manually.",
      },
      { status: 400 }
    );
  }

  const meta = await fetchYoutubeVideoMeta(id);
  if (!meta.ok) {
    return NextResponse.json(
      { ok: false, code: meta.code, message: meta.message, youtubeId: id },
      { status: 422 }
    );
  }

  return NextResponse.json(meta);
}
