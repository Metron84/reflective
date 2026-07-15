-- Person-first model: person_id groups rows; canonical marks best-known era.

alter table public.players
  add column if not exists person_id text,
  add column if not exists canonical boolean not null default false;

create index if not exists players_person_id_idx on public.players (person_id);
create index if not exists players_canonical_idx on public.players (person_id, canonical)
  where canonical = true;
