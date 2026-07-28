-- Optional nation label for image-free Reflectives nominee cards (flag colour bands).
alter table public.nominees
  add column if not exists nation text;
