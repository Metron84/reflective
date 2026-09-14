import { requireAdminPage } from "@/lib/auth/admin";
import { getServiceClient } from "@/lib/supabase";
import KotbInbox from "@/components/admin/kotb/KotbInbox";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "King of the Burgers",
  robots: { index: false, follow: false },
};

export default async function AdminKotbPage() {
  await requireAdminPage();
  const supabase = getServiceClient();

  let rows = [];
  if (supabase) {
    const { data } = await supabase
      .from("kotb_applications")
      .select(
        "id, created_at, venue_name, area, contact_name, contact_email, contact_mobile, burger_name, is_halal, screen_count, matchday_footfall, status, seed",
      )
      .order("created_at", { ascending: false });
    rows = data ?? [];
  }

  return <KotbInbox initialRows={rows} />;
}
