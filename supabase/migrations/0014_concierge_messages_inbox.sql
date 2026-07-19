-- Concierge messages inbox: updated_at + status check.
-- Run in Supabase SQL Editor after 0013.

alter table public.concierge_messages
  add column if not exists updated_at timestamptz not null default now();

alter table public.concierge_messages
  alter column status set default 'new';

-- Drop loose check if re-run; enforce allowed statuses.
alter table public.concierge_messages
  drop constraint if exists concierge_messages_status_check;

alter table public.concierge_messages
  add constraint concierge_messages_status_check
  check (status in ('new', 'read', 'handled'));

create or replace function public.set_concierge_messages_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists concierge_messages_set_updated_at on public.concierge_messages;
create trigger concierge_messages_set_updated_at
  before update on public.concierge_messages
  for each row
  execute function public.set_concierge_messages_updated_at();
