const MESSAGE_COLUMNS =
  "id, created_at, updated_at, name, email, topic, message, status, source_conversation, source, supporters_club, publish_consent";

const MESSAGE_COLUMNS_BASE =
  "id, created_at, updated_at, name, email, topic, message, status, source_conversation";

function filtered(supabase, columns, status) {
  let query = supabase
    .from("concierge_messages")
    .select(columns)
    .order("created_at", { ascending: false });
  if (status === "new") query = query.eq("status", "new");
  if (status === "handled") query = query.eq("status", "handled");
  return query;
}

/** Extended columns, then the original set if the Your Say migration is not applied yet. */
export async function listConciergeMessages(supabase, status) {
  const extended = await filtered(supabase, MESSAGE_COLUMNS, status);
  if (!extended.error) return extended;
  return filtered(supabase, MESSAGE_COLUMNS_BASE, status);
}

export async function updateConciergeMessageStatus(supabase, id, status) {
  const extended = await supabase
    .from("concierge_messages")
    .update({ status })
    .eq("id", id)
    .select(MESSAGE_COLUMNS)
    .maybeSingle();
  if (!extended.error) return extended;
  return supabase
    .from("concierge_messages")
    .update({ status })
    .eq("id", id)
    .select(MESSAGE_COLUMNS_BASE)
    .maybeSingle();
}
