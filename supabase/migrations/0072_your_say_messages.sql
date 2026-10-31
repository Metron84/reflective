-- Your Say fields on the Write to Melo inbox.
-- Run in the Supabase SQL Editor after 0071. Not applied by the app.

alter table public.concierge_messages
  add column if not exists source text,
  add column if not exists supporters_club text,
  add column if not exists publish_consent boolean not null default false,
  add column if not exists submitter_hash text;

create index if not exists concierge_messages_your_say_cooldown_idx
  on public.concierge_messages (submitter_hash, created_at desc)
  where source = 'your-say';
