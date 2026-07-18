-- Archive Classic mode data (Classic removed; World Cup Legends is the free daily).
-- Rows are preserved under classic_archived for admin/history; the app no longer reads them.

update public.plays
set mode = 'classic_archived'
where mode = 'classic';

update public.puzzles
set mode = 'classic_archived'
where mode = 'classic';
