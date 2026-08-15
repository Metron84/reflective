-- Managers can opt into auto-draft (queue, then ranking).
-- Run after 0023_ultima_practice.sql.

alter table public.ultima_managers
  add column if not exists auto_draft boolean not null default false;
