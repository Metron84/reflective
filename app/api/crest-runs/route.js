import { crestRunInsert } from "@/lib/crest/runLog";

/**
 * Insert one finished run. The anon key stays on the server.
 * Every failure returns an empty response.
 */
export async function POST(request) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return empty();
    const input = await request.json();
    const row = crestRunInsert(input, new Date().toISOString());
    await fetch(`${url.replace(/\/$/, "")}/rest/v1/crest_runs`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
  } catch {
    /* silent */
  }
  return empty();
}

function empty() {
  return new Response(null, { status: 204 });
}
