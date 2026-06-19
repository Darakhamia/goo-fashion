-- Add a logo URL to brands so store logos can be shown in the homepage
-- "Where to buy" list. Run once in the Supabase SQL editor.
alter table public.brands
  add column if not exists logo_url text;
