-- Migration 032: who an outfit is for.
--
-- By the CEO's request of 2026-10-27 an outfit has a gender — women, men or
-- unisex — set in the builder, My looks and the studio, and chosen by the AI
-- for the outfits it puts together; Browse filters outfits by it.
--
--   outfits.gender, pending_looks.gender, user_looks.gender
--     text: 'women' | 'men' | 'unisex'; null = not chosen.
--
-- No backfill: an outfit without a gender is read from its pieces at display
-- time (src/lib/outfit-gender.ts) — women's pieces make a women's outfit,
-- men's a men's, anything else unisex — so existing outfits filter correctly
-- without their rows being rewritten, and an admin can still set one.
--
-- Without this file the site works as before: genders are read from the
-- pieces, and a chosen one is not stored.
--
-- Changes no existing data. Idempotent: safe to re-run.

alter table if exists public.outfits
  add column if not exists gender text;

alter table if exists public.pending_looks
  add column if not exists gender text;

alter table if exists public.user_looks
  add column if not exists gender text;

notify pgrst, 'reload schema';
