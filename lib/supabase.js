import { createClient } from "@supabase/supabase-js";

let serverClient;

// Server-only client using the service role key. Never import from
// client components. Returns null until env vars are configured so
// development can run against SAMPLE data.
export function getServiceClient() {
  if (serverClient !== undefined) return serverClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  serverClient = url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
  return serverClient;
}
