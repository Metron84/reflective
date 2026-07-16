import { createBrowserClient } from "@supabase/ssr";

function logMissingAuthEnv(url, key) {
  const failed = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);

  console.error(
    "[TRF auth] createClient() failed — missing:",
    failed.join(", "),
    {
      urlPresent: Boolean(url),
      keyPresent: Boolean(key),
      urlLength: url?.length ?? 0,
      keyLength: key?.length ?? 0,
    }
  );
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    logMissingAuthEnv(url, key);
    return null;
  }
  return createBrowserClient(url, key);
}
