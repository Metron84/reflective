import { NextResponse } from "next/server";
import { adminClient, badRequest } from "../_helpers";
import { FIXTURE_TYPES } from "@/lib/admin/constants";
import { parseYoutubeId } from "@/lib/admin/youtube";

export const runtime = "nodejs";

function normalizeVideo(body) {
  const youtubeId = parseYoutubeId(body.youtube_id ?? body.youtubeId ?? "");
  if (!youtubeId) return { error: "Valid YouTube id is required." };

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { error: "Title is required." };

  const fixture_type =
    body.fixture_type == null || body.fixture_type === ""
      ? null
      : String(body.fixture_type);
  if (fixture_type && !FIXTURE_TYPES.includes(fixture_type)) {
    return { error: "Invalid fixture type." };
  }

  let atmosphere_index = null;
  if (body.atmosphere_index != null && body.atmosphere_index !== "") {
    atmosphere_index = Number(body.atmosphere_index);
    if (
      !Number.isFinite(atmosphere_index) ||
      atmosphere_index < 1 ||
      atmosphere_index > 10
    ) {
      return { error: "Atmosphere must be 1–10." };
    }
  }

  const vibe_tags = Array.isArray(body.vibe_tags)
    ? body.vibe_tags.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const languages = Array.isArray(body.languages)
    ? body.languages.map((t) => String(t).trim()).filter(Boolean)
    : [];

  return {
    row: {
      youtube_id: youtubeId,
      title,
      published_at: body.published_at || null,
      fixture: body.fixture ? String(body.fixture).trim() : null,
      fixture_date: body.fixture_date || null,
      fixture_type,
      competition: body.competition ? String(body.competition).trim() : null,
      venue_id: body.venue_id || null,
      atmosphere_index,
      vibe_tags,
      languages,
      description: body.description ? String(body.description).trim() : null,
    },
    fanGroupIds: Array.isArray(body.fan_group_ids)
      ? body.fan_group_ids.filter(Boolean)
      : [],
  };
}

async function syncFanGroups(supabase, videoId, fanGroupIds) {
  await supabase.from("video_fan_groups").delete().eq("video_id", videoId);
  if (!fanGroupIds.length) return;
  const rows = fanGroupIds.map((fan_group_id) => ({
    video_id: videoId,
    fan_group_id,
  }));
  const { error } = await supabase.from("video_fan_groups").insert(rows);
  if (error) throw error;
}

export async function GET() {
  const { supabase, error } = await adminClient();
  if (error) return error;

  const { data: videos, error: vErr } = await supabase
    .from("videos")
    .select("*, venues(id, name), video_fan_groups(fan_group_id)")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (vErr) {
    return NextResponse.json({ message: vErr.message }, { status: 500 });
  }

  const shaped = (videos ?? []).map((v) => ({
    ...v,
    venue: v.venues ?? null,
    fan_group_ids: (v.video_fan_groups ?? []).map((j) => j.fan_group_id),
    venues: undefined,
    video_fan_groups: undefined,
  }));

  return NextResponse.json({ videos: shaped });
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
  const parsed = normalizeVideo(body);
  if (parsed.error) return badRequest(parsed.error);

  const { data, error: qErr } = await supabase
    .from("videos")
    .insert(parsed.row)
    .select("*")
    .single();
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }

  try {
    await syncFanGroups(supabase, data.id, parsed.fanGroupIds);
  } catch (e) {
    return NextResponse.json(
      { message: e.message ?? "Could not link fan groups." },
      { status: 500 }
    );
  }

  return NextResponse.json({ video: { ...data, fan_group_ids: parsed.fanGroupIds } });
}

export async function PATCH(request) {
  const { supabase, error } = await adminClient();
  if (error) return error;
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request.");
  }
  if (!body.id) return badRequest("Missing id.");
  const parsed = normalizeVideo(body);
  if (parsed.error) return badRequest(parsed.error);

  const { data, error: qErr } = await supabase
    .from("videos")
    .update(parsed.row)
    .eq("id", body.id)
    .select("*")
    .single();
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }

  try {
    await syncFanGroups(supabase, data.id, parsed.fanGroupIds);
  } catch (e) {
    return NextResponse.json(
      { message: e.message ?? "Could not link fan groups." },
      { status: 500 }
    );
  }

  return NextResponse.json({ video: { ...data, fan_group_ids: parsed.fanGroupIds } });
}
