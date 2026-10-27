-- Migration 030: an outfit is for several seasons, not one.
--
-- `outfits.season` held one word — 'all', 'spring', 'summer', 'autumn' or
-- 'winter' — set only in the studio's old outfit dialog and read nowhere: no
-- filter used it and the builder never asked for it. By the CEO's decision of
-- 2026-10-27 an outfit takes several seasons (a light-jacket look is for spring
-- and autumn both), Browse filters outfits by them, and the builder, My looks
-- and the studio all set them.
--
--   outfits.seasons, pending_looks.seasons, user_looks.seasons
--     text[], empty = every season. Values: spring, summer, autumn, winter.
--
-- Existing outfits and submissions get their single season as a one-item list
-- ('fall' read as 'autumn'); 'all' and anything else stay empty, which is what
-- 'all' meant. Saved looks (user_looks) never had a season, so theirs start
-- empty. The CEO approved this backfill on 2026-10-27 ("Несколько сезонов").
--
-- The old `season` column stays and the site keeps writing it (the one season,
-- or 'all'), so nothing that reads it breaks. `occasion` is left alone too:
-- styles replaced it in the interface, the data is not touched.
--
-- Without this file the site works as before: outfits show and filter by the
-- old single season, and a choice of several is stored as 'all'.
--
-- Idempotent: the columns are added once, and the backfill only fills a list
-- that is still empty.

alter table if exists public.outfits
  add column if not exists seasons text[] not null default '{}';

alter table if exists public.pending_looks
  add column if not exists seasons text[] not null default '{}';

alter table if exists public.user_looks
  add column if not exists seasons text[] not null default '{}';

do $$
begin
  if to_regclass('public.outfits') is not null then
    update public.outfits
       set seasons = array[case when lower(season) = 'fall' then 'autumn' else lower(season) end]
     where seasons = '{}'
       and lower(season) in ('spring', 'summer', 'autumn', 'fall', 'winter');
  end if;

  if to_regclass('public.pending_looks') is not null then
    update public.pending_looks
       set seasons = array[case when lower(season) = 'fall' then 'autumn' else lower(season) end]
     where seasons = '{}'
       and lower(season) in ('spring', 'summer', 'autumn', 'fall', 'winter');
  end if;
end $$;

notify pgrst, 'reload schema';
