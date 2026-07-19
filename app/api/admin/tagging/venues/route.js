import { NextResponse } from "next/server";
import { adminClient, badRequest } from "../_helpers";
import { CAPACITY_VIBES, VENUE_SETTINGS } from "@/lib/admin/constants";

export const runtime = "nodejs";

function normalizeVenue(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Name is required." };

  const setting =
    body.setting == null || body.setting === ""
      ? null
      : String(body.setting);
  if (setting && !VENUE_SETTINGS.includes(setting)) {
    return { error: "Invalid setting." };
  }

  const capacity_vibe =
    body.capacity_vibe == null || body.capacity_vibe === ""
      ? null
      : String(body.capacity_vibe);
  if (capacity_vibe && !CAPACITY_VIBES.includes(capacity_vibe)) {
    return { error: "Invalid capacity vibe." };
  }

  let typical_group_max = null;
  if (body.typical_group_max != null && body.typical_group_max !== "") {
    typical_group_max = Number(body.typical_group_max);
    if (!Number.isFinite(typical_group_max) || typical_group_max < 0) {
      return { error: "Invalid typical group max." };
    }
  }

  return {
    row: {
      name,
      area: body.area ? String(body.area).trim() : null,
      city: body.city ? String(body.city).trim() : "Dubai",
      setting,
      capacity_vibe,
      outdoor_seating:
        body.outdoor_seating == null ? null : Boolean(body.outdoor_seating),
      typical_group_max,
      food_drink_notes: body.food_drink_notes
        ? String(body.food_drink_notes).trim()
        : null,
      notes: body.notes ? String(body.notes).trim() : null,
    },
  };
}

export async function GET() {
  const { supabase, error } = await adminClient();
  if (error) return error;
  const { data, error: qErr } = await supabase
    .from("venues")
    .select("*")
    .order("name");
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ venues: data ?? [] });
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
  const parsed = normalizeVenue(body);
  if (parsed.error) return badRequest(parsed.error);
  const { data, error: qErr } = await supabase
    .from("venues")
    .insert(parsed.row)
    .select("*")
    .single();
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ venue: data });
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
  const parsed = normalizeVenue(body);
  if (parsed.error) return badRequest(parsed.error);
  const { data, error: qErr } = await supabase
    .from("venues")
    .update(parsed.row)
    .eq("id", body.id)
    .select("*")
    .single();
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ venue: data });
}
