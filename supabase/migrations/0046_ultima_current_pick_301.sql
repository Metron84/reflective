-- Allow current_pick to reach 301 so the final pick (300) can close the draft.
-- Already applied in production on 4 Oct 2026; safe to re-run.
alter table public.ultima_draft_state
  drop constraint if exists ultima_draft_state_current_pick_check;

alter table public.ultima_draft_state
  add constraint ultima_draft_state_current_pick_check
  check (current_pick between 1 and 301);
