-- Allow optional describes_you and filmed_before on slimmed apply form.
alter table public.training_applications
  alter column describes_you drop not null,
  alter column filmed_before drop not null;
