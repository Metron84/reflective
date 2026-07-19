import { NextResponse } from "next/server";
import { adminClient, badRequest } from "../_helpers";

export const runtime = "nodejs";

function normalizeFanGroup(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Name is required." };
  return {
    row: {
      name,
      club: body.club ? String(body.club).trim() : null,
      country: body.country ? String(body.country).trim() : null,
    },
  };
}

export async function GET() {
  const { supabase, error } = await adminClient();
  if (error) return error;
  const { data, error: qErr } = await supabase
    .from("fan_groups")
    .select("*")
    .order("name");
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ fanGroups: data ?? [] });
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
  const parsed = normalizeFanGroup(body);
  if (parsed.error) return badRequest(parsed.error);
  const { data, error: qErr } = await supabase
    .from("fan_groups")
    .insert(parsed.row)
    .select("*")
    .single();
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ fanGroup: data });
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
  const parsed = normalizeFanGroup(body);
  if (parsed.error) return badRequest(parsed.error);
  const { data, error: qErr } = await supabase
    .from("fan_groups")
    .update(parsed.row)
    .eq("id", body.id)
    .select("*")
    .single();
  if (qErr) {
    return NextResponse.json({ message: qErr.message }, { status: 500 });
  }
  return NextResponse.json({ fanGroup: data });
}
