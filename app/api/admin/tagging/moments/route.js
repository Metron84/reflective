import { NextResponse } from "next/server";
import { adminClient, badRequest } from "../_helpers";
import { MOMENT_TYPES } from "@/lib/admin/constants";

export const runtime = "nodejs";

export async function GET(request) {
  const { supabase, error } = await adminClient();
  if (error) return error;
  const videoId = new URL(request.url).searchParams.get("video_id");
  if (!videoId) return badRequest("video_id required.");

  const { data, error: qErr } = await supabase
    .from("video_moments")
    .select("*")
    .eq("video_id", videoId)
    .order("timestamp_seconds");
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ moments: data ?? [] });
}

export async function POST(request) {
  const { supabase, error } = await adminClient();
  if (error) return error;
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request.");
  }

  if (!body.video_id) return badRequest("video_id required.");
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return badRequest("Label is required.");

  const timestamp_seconds = Number(body.timestamp_seconds);
  if (!Number.isFinite(timestamp_seconds) || timestamp_seconds < 0) {
    return badRequest("Timestamp must be zero or greater.");
  }

  const moment_type =
    body.moment_type == null || body.moment_type === ""
      ? null
      : String(body.moment_type);
  if (moment_type && !MOMENT_TYPES.includes(moment_type)) {
    return badRequest("Invalid moment type.");
  }

  const { data, error: qErr } = await supabase
    .from("video_moments")
    .insert({
      video_id: body.video_id,
      timestamp_seconds: Math.floor(timestamp_seconds),
      label,
      moment_type,
    })
    .select("*")
    .single();
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ moment: data });
}

export async function DELETE(request) {
  const { supabase, error } = await adminClient();
  if (error) return error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return badRequest("id required.");

  const { error: qErr } = await supabase
    .from("video_moments")
    .delete()
    .eq("id", id);
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
