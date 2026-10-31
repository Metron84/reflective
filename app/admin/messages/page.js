import { requireAdminPage } from "@/lib/auth/admin";
import { listConciergeMessages } from "@/lib/concierge/inbox";
import { getRenderClient } from "@/lib/supabase/server";
import MessagesInbox from "@/components/admin/messages/MessagesInbox";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Messages",
  robots: { index: false },
};

export default async function AdminMessagesPage({ searchParams }) {
  await requireAdminPage();
  const supabase = await getRenderClient();

  const params = await searchParams;
  const raw = typeof params?.status === "string" ? params.status : "all";
  const filter =
    raw === "new" || raw === "handled" || raw === "all" ? raw : "all";

  let messages = [];
  let newCount = 0;

  if (supabase) {
    const [listRes, countRes] = await Promise.all([
      listConciergeMessages(supabase, filter),
      supabase
        .from("concierge_messages")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

    messages = listRes.data ?? [];
    newCount = countRes.count ?? 0;
  }

  return (
    <MessagesInbox
      initialMessages={messages}
      initialNewCount={newCount}
      initialFilter={filter}
    />
  );
}
