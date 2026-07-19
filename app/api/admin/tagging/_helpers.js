import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/admin";

export async function adminClient() {
  const gate = await requireAdminApi();
  if (!gate.ok) {
    return {
      error: NextResponse.json({ message: gate.message }, { status: gate.status }),
    };
  }
  const supabase = await createClient();
  if (!supabase) {
    return {
      error: NextResponse.json({ message: "Not configured." }, { status: 503 }),
    };
  }
  return { supabase, gate };
}

export function badRequest(message) {
  return NextResponse.json({ message }, { status: 400 });
}
