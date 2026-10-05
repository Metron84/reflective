-- Ultima club sync: loan labels and sync stamp.
-- Write only. Melo applies in the Supabase SQL editor.
--
-- Club and loan fields update on every sync. League changes wait for the next
-- Friday 00:00 Dubai unlock (stored in seed_metrics.pending_league until then).

alter table public.ultima_players
  add column if not exists on_loan boolean not null default false,
  add column if not exists parent_club text,
  add column if not exists club_synced_at timestamptz;

comment on column public.ultima_players.on_loan is
  'True when Sportmonks lists the player on loan at the current club.';
comment on column public.ultima_players.parent_club is
  'Parent club name when on_loan; null otherwise.';
comment on column public.ultima_players.club_synced_at is
  'When club / loan fields were last confirmed from current squads.';
