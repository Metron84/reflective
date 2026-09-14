import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const STATUSES = new Set(["new", "reviewing", "accepted", "declined"]);

export async function PATCH(request) {
  const gate = await requireAdminApi();
  if (!gate.ok) {
    return NextResponse.json({ message: gate.message }, { status: gate.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ message: "Missing id." }, { status: 400 });
  }

  const patch = {};
  if (body?.status != null) {
    const status = String(body.status).trim();
    if (!STATUSES.has(status)) {
      return NextResponse.json({ message: "Invalid status." }, { status: 400 });
    }
    patch.status = status;
  }

  if (Object.prototype.hasOwnProperty.call(body, "seed")) {
    if (body.seed === null || body.seed === "") {
      patch.seed = null;
    } else {
      const seed = Number(body.seed);
      if (!Number.isInteger(seed)) {
        return NextResponse.json({ message: "Invalid seed." }, { status: 400 });
      }
      patch.seed = seed;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "Nothing to update." }, { status: 400 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ message: "Not configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("kotb_applications")
    .update(patch)
    .eq("id", id)
    .select(
      "id, created_at, venue_name, area, contact_name, contact_email, contact_mobile, burger_name, is_halal, screen_count, matchday_footfall, status, seed",
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ row: data });
}
