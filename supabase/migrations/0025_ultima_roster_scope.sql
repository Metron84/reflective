-- Ultima 0025: scope squads to their competition and let the draft finish.
-- Run after 0024_ultima_auto_draft.sql.
--
-- Before this migration ultima_rosters had a single global unique index on
-- player_id, which was correct while one competition existed. Practice rooms
-- (0023) added more competitions, so the first practice draft claimed up to
-- 300 players for every other competition, including the real season.

-- ---------------------------------------------------------------------------
-- 1. Release players claimed by practice competitions.
--    Deleting the competition cascades to its managers, squads and picks.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ultima_competition'
      and column_name = 'kind'
  ) then
    delete from public.ultima_competition where kind = 'practice';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Give squads a competition.
-- ---------------------------------------------------------------------------

alter table public.ultima_rosters
  add column if not exists competition_id uuid
  references public.ultima_competition (id) on delete cascade;

update public.ultima_rosters r
set competition_id = m.competition_id
from public.ultima_managers m
where m.id = r.manager_id
  and r.competition_id is null;

-- Any row whose manager no longer exists cannot be attributed to a season.
delete from public.ultima_rosters where competition_id is null;

alter table public.ultima_rosters
  alter column competition_id set not null;

-- ---------------------------------------------------------------------------
-- 3. Populate competition_id from the manager on every write, so no caller
--    can reintroduce an unscoped squad row.
-- ---------------------------------------------------------------------------

create or replace function public.ultima_rosters_set_competition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.competition_id is null then
    select m.competition_id
    into new.competition_id
    from public.ultima_managers m
    where m.id = new.manager_id;
  end if;

  if new.competition_id is null then
    raise exception 'ultima_rosters.manager_id % has no competition', new.manager_id;
  end if;

  return new;
end;
$$;

drop trigger if exists ultima_rosters_set_competition_trg on public.ultima_rosters;

create trigger ultima_rosters_set_competition_trg
  before insert or update on public.ultima_rosters
  for each row
  execute function public.ultima_rosters_set_competition();

-- ---------------------------------------------------------------------------
-- 4. A player belongs to one squad per competition, not one squad in total.
-- ---------------------------------------------------------------------------

drop index if exists public.ultima_rosters_player_key;

create unique index if not exists ultima_rosters_competition_player_key
  on public.ultima_rosters (competition_id, player_id);

create index if not exists ultima_rosters_competition_idx
  on public.ultima_rosters (competition_id);

-- ---------------------------------------------------------------------------
-- 5. Identity for row level security follows the active season.
--    The original helper took any manager row for the user, so once a member
--    also held a practice seat it could answer with the wrong one.
-- ---------------------------------------------------------------------------

create or replace function public.ultima_current_manager_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.ultima_managers m
  join public.ultima_competition c on c.id = m.competition_id
  where m.user_id = auth.uid()
    and m.is_bot = false
    and c.is_active = true
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 6. Let the draft reach completion.
--    The final pick advances current_pick to 301, which 0021 rejected, so the
--    draft stayed live at pick 300 forever and the market never opened.
-- ---------------------------------------------------------------------------

alter table public.ultima_draft_state
  drop constraint if exists ultima_draft_state_current_pick_check;

alter table public.ultima_draft_state
  add constraint ultima_draft_state_current_pick_check
  check (current_pick between 1 and 301);
