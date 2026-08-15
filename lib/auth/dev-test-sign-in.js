import { defaultNameFromEmail } from "@/lib/auth/config";
import { getServiceClient } from "@/lib/supabase";

export const DEV_TEST_SIGNIN_EMAIL =
  process.env.DEV_TEST_SIGNIN_EMAIL?.trim() ||
  "dev-preview@thereflectivefootball.local";

export function isDevTestSignInAllowed() {
  if (process.env.DEV_TEST_SIGNIN_ENABLED === "false") return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEV_TEST_SIGNIN_ENABLED !== "true"
  ) {
    return false;
  }
  return Boolean(getServiceClient());
}

export function devTestSignInBlockReason() {
  if (process.env.DEV_TEST_SIGNIN_ENABLED === "false") {
    return "disabled";
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEV_TEST_SIGNIN_ENABLED !== "true"
  ) {
    return "production";
  }
  if (!getServiceClient()) return "missing_service_role";
  return null;
}

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function ensureDevTestUser(admin, email = DEV_TEST_SIGNIN_EMAIL) {
  let user = await findUserByEmail(admin, email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { dev_test: true },
    });
    if (error) throw error;
    user = data.user;
  }

  const preferredName = defaultNameFromEmail(email);
  await admin.from("profiles").upsert(
    {
      id: user.id,
      preferred_name: preferredName,
      clubs: [],
      welcome_completed: true,
      marketing_consent: false,
    },
    { onConflict: "id" },
  );

  return user;
}

export async function ensureDevUltimaManager(admin, userId) {
  let { data: competition } = await admin
    .from("ultima_competition")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (!competition) {
    const { data: created, error } = await admin
      .from("ultima_competition")
      .insert({
        season_label: "2026/27",
        timer_seconds: 60,
        rating_thresholds: {
          pl: { band1: 7.0, band2: 7.5 },
          laliga: { band1: 7.0, band2: 7.5 },
          seriea: { band1: 7.0, band2: 7.5 },
        },
      })
      .select("id")
      .single();
    if (error) throw error;
    competition = created;

    await admin.from("ultima_draft_state").upsert(
      {
        competition_id: competition.id,
        state: "lobby",
      },
      { onConflict: "competition_id" },
    );
  }

  const { data: existing } = await admin
    .from("ultima_managers")
    .select("id")
    .eq("user_id", userId)
    .eq("is_bot", false)
    .maybeSingle();

  if (existing) {
    await admin
      .from("ultima_managers")
      .update({
        team_name: "Dev FC",
        manager_name: "Dev Preview",
        colour: "navy",
        profile_complete: true,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: manager, error } = await admin
    .from("ultima_managers")
    .insert({
      competition_id: competition.id,
      user_id: userId,
      team_name: "Dev FC",
      manager_name: "Dev Preview",
      colour: "navy",
      profile_complete: true,
      is_bot: false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return manager.id;
}

export async function createDevTestSignInLink(origin, { next = "/", ultima = false } = {}) {
  const admin = getServiceClient();
  if (!admin) throw new Error("Supabase service role not configured");

  const user = await ensureDevTestUser(admin);
  if (ultima) {
    await ensureDevUltimaManager(admin, user.id);
  }

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo },
  });

  if (error) throw error;
  return data.properties?.action_link ?? null;
}
