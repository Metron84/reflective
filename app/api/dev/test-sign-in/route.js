import { NextResponse } from "next/server";
import {
  createDevTestSignInLink,
  devTestSignInBlockReason,
  isDevTestSignInAllowed,
} from "@/lib/auth/dev-test-sign-in";

export const runtime = "nodejs";

export async function GET(request) {
  if (!isDevTestSignInAllowed()) {
    const reason = devTestSignInBlockReason();
    const message =
      reason === "missing_service_role"
        ? "Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the dev server."
        : reason === "production"
          ? "Dev test sign-in is disabled in production."
          : "Dev test sign-in is not available.";
    return NextResponse.json({ error: message, reason }, { status: 403 });
  }

  const { searchParams, origin } = new URL(request.url);
  const next =
    searchParams.get("next")?.startsWith("/") ? searchParams.get("next") : "/";
  const ultima = searchParams.get("ultima") === "1";

  try {
    const actionLink = await createDevTestSignInLink(origin, { next, ultima });
    if (!actionLink) {
      return NextResponse.json(
        { error: "Could not create sign-in link." },
        { status: 500 },
      );
    }
    return NextResponse.redirect(actionLink);
  } catch (err) {
    console.error("[dev test sign-in]", err);
    return NextResponse.json(
      { error: "Dev test sign-in failed. Check service role key and migrations." },
      { status: 500 },
    );
  }
}
