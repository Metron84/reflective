import { NextResponse } from "next/server";
import { adminClient, badRequest } from "@/app/api/admin/tagging/_helpers";
import { listConciergeMessages } from "@/lib/concierge/inbox";

export const runtime = "nodejs";

const FILTERS = new Set(["all", "new", "handled"]);

export async function GET(request) {
  const { supabase, error } = await adminClient();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  if (!FILTERS.has(status)) {
    return badRequest("Invalid status filter.");
  }

  const [{ data, error: listError }, { count: newCount, error: countError }] =
    await Promise.all([
      listConciergeMessages(supabase, status),
      supabase
        .from("concierge_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

  if (listError || countError) {
    return NextResponse.json(
      { message: listError?.message || countError?.message || "Load failed." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    messages: data ?? [],
    newCount: newCount ?? 0,
  });
}
