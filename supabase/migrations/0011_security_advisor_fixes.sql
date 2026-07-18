-- Security Advisor fixes: pin search_path on trigger functions and
-- revoke direct EXECUTE from client roles. Triggers still fire; the
-- invoker does not need EXECUTE on trigger functions.
-- Run in the Supabase SQL editor after 0010_archive_classic_plays.sql.

create or replace function public.protect_profile_immutables()
returns trigger
language plpgsql
set search_path = public
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

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_profile_immutables() from public, anon, authenticated;
