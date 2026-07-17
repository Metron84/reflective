-- Optional YouTube start offset (seconds) for shared-video nominees.
alter table public.nominees
  add column if not exists clip_start_seconds integer;
