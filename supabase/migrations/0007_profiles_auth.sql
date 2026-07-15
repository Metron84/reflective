-- Phase 4: profiles, member numbers, auth hooks.
-- Run in the Supabase SQL editor after 0006_subscribers.sql.

create sequence if not exists public.member_number_seq
  start with 1
  increment by 1
  no minvalue
  no maxvalue
  cache 1;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  preferred_name text not null,
  clubs text[] not null default '{}',
  member_number bigint not null unique default nextval('public.member_number_seq'),
  marketing_consent boolean not null default false,
  welcome_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter sequence public.member_number_seq owned by public.profiles.member_number;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_name text;
begin
  default_name := split_part(coalesce(new.email, 'fan'), '@', 1);
  if default_name = '' then
    default_name := 'Fan';
  end if;

  insert into public.profiles (id, preferred_name, welcome_completed)
  values (new.id, default_name, false)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile_immutables()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.member_number := old.member_number;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_immutables on public.profiles;
create trigger profiles_protect_immutables
  before update on public.profiles
  for each row execute function public.protect_profile_immutables();

alter table public.profiles enable row level security;

create policy "Profiles: users read own row"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Profiles: users update own row"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Signed-in members: one play record per mode per day.
create unique index if not exists plays_user_daily_key
  on public.plays (user_id, puzzle_date, mode)
  where user_id is not null;
