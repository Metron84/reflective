-- Ultima v5: five leagues, 30-man squad, 15 starters, 300 draft picks.
-- Run after 0020_ultima_personas_seed.sql.

alter table public.ultima_players
  drop constraint if exists ultima_players_league_check;

alter table public.ultima_players
  add constraint ultima_players_league_check
  check (league in ('pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'));

alter table public.ultima_fixtures
  drop constraint if exists ultima_fixtures_league_check;

alter table public.ultima_fixtures
  add constraint ultima_fixtures_league_check
  check (league in ('pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'));

alter table public.ultima_draft_picks
  drop constraint if exists ultima_draft_picks_forced_league_check;

alter table public.ultima_draft_picks
  add constraint ultima_draft_picks_forced_league_check
  check (
    forced_league is null
    or forced_league in ('pl', 'laliga', 'seriea', 'bundesliga', 'ligue1')
  );

alter table public.ultima_lineups
  drop constraint if exists ultima_lineups_slot_check;

alter table public.ultima_lineups
  add constraint ultima_lineups_slot_check
  check (slot between 1 and 15);

alter table public.ultima_lineups
  drop constraint if exists ultima_lineups_slot_group_check;

alter table public.ultima_lineups
  add constraint ultima_lineups_slot_group_check
  check (slot_group in ('pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'));

alter table public.ultima_draft_picks
  drop constraint if exists ultima_draft_picks_round_check;

alter table public.ultima_draft_picks
  add constraint ultima_draft_picks_round_check
  check (round between 1 and 30);

alter table public.ultima_draft_picks
  drop constraint if exists ultima_draft_picks_pick_number_check;

alter table public.ultima_draft_picks
  add constraint ultima_draft_picks_pick_number_check
  check (pick_number between 1 and 300);

alter table public.ultima_players
  drop constraint if exists ultima_players_draft_round_check;

alter table public.ultima_players
  add constraint ultima_players_draft_round_check
  check (draft_round between 1 and 30);

alter table public.ultima_draft_state
  drop constraint if exists ultima_draft_state_current_pick_check;

alter table public.ultima_draft_state
  add constraint ultima_draft_state_current_pick_check
  check (current_pick between 1 and 300);

update public.ultima_competition
set rating_thresholds = coalesce(rating_thresholds, '{}'::jsonb)
  || '{"bundesliga":{"band1":7.0,"band2":7.5},"ligue1":{"band1":7.0,"band2":7.5}}'::jsonb
where is_active = true;
