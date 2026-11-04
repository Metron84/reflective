-- Commissioner unlock/relock for one league on the current gameweek.
-- Values: { "pl": "unlocked" | "locked", ... }. Cleared when the gameweek advances.

alter table public.ultima_gameweeks
  add column if not exists league_lock_override jsonb not null default '{}'::jsonb;
