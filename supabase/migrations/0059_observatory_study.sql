-- Observatory: anonymous behavioural studies
create table if not exists public.study_responses (
  id uuid primary key default gen_random_uuid(),
  study_slug text not null,                -- 'footballer-001'
  study_version int not null default 1,
  session_id uuid not null,                -- random id stored in the browser, not tied to any account
  locale text not null default 'en',
  consent boolean not null default false,
  branch text check (branch in ('win','entertain','connect')),
  leader_after_core text,                  -- archetype key that selected the tension question
  primary_archetype text,
  secondary_archetype text,
  scores jsonb,                            -- {"W":5,"L":3,...}
  perception text,                         -- archetype key the fan picked for their own club
  club text,
  age_bracket text,
  ted_lasso text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (study_slug, session_id)
);

create table if not exists public.study_answers (
  id bigint generated always as identity primary key,
  response_id uuid not null references public.study_responses(id) on delete cascade,
  step int not null,                       -- 1 to 6
  question_id text not null,               -- e.g. 'q1', 'win1', 'tW'
  option_id text not null,                 -- e.g. 'q1_win'
  shown_position int not null,             -- 1 to 3, position on screen after shuffle
  answered_at timestamptz not null default now(),
  unique (response_id, step)
);

create index if not exists study_responses_slug_idx on public.study_responses (study_slug, completed_at);
create index if not exists study_answers_response_idx on public.study_answers (response_id);

-- Locked down: no anon or authenticated access. All reads and writes go through server routes using the service role.
alter table public.study_responses enable row level security;
alter table public.study_answers enable row level security;

-- Analysis view: one row per completed response
create or replace view public.study_results_v
with (security_invoker = true) as
select r.id, r.study_slug, r.study_version, r.locale, r.branch, r.leader_after_core,
       r.primary_archetype, r.secondary_archetype, r.scores, r.perception,
       (r.perception = r.primary_archetype) as perception_matches,
       r.club, r.age_bracket, r.ted_lasso, r.started_at, r.completed_at,
       extract(epoch from (r.completed_at - r.started_at))::int as seconds_taken
from public.study_responses r
where r.completed_at is not null;
