import { NextResponse } from "next/server";
import { adminClient, badRequest } from "@/app/api/admin/tagging/_helpers";

export const runtime = "nodejs";

const STATUSES = new Set(["new", "read", "handled"]);

export async function PATCH(request, { params }) {
  const { supabase, error } = await adminClient();
  if (error) return error;

  const { id } = await params;
  if (!id) return badRequest("Missing id.");

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid request.");
  }

  const status = typeof body?.status === "string" ? body.status.trim() : "";
  if (!STATUSES.has(status)) {
    return badRequest("Invalid status.");
  }

  const { data, error: updateError } = await supabase
    .from("concierge_messages")
    .update({ status })
    .eq("id", id)
    .select(
      "id, created_at, updated_at, name, email, topic, message, status, source_conversation"
    )
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ message: updateError.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ message: data });
}
