-- Add a store homepage URL to the store library so the homepage "Where to buy"
-- rows can link straight to the store — even when the featured item isn't sold
-- there (clicking just opens the store). Run once in the Supabase SQL editor.
alter table public.brands
  add column if not exists url text;
