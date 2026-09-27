-- Migration 023: The admin's crop of a product photo.
--
-- The crop editor on the Products page stores where the card should zoom into
-- the photo: a frame (x, y, width, height) and a focal point (focalX, focalY),
-- all as fractions of the card's image box. The storefront card and the card
-- export read it back; NULL means "show the whole photo".
--
-- The column used to be added from the admin page itself, through a
-- "Database migration required" dialog and an RPC (run_sql) that no database
-- of ours defines. That dialog is gone, so the DDL lives here instead.
--
-- Idempotent: safe to re-run.

alter table public.products
  add column if not exists crop_data jsonb default null;

-- No embedded quotes in this comment, so it survives being pasted into any
-- SQL box.
comment on column public.products.crop_data is
  'Admin crop of the product photo: x, y, width, height and focalX, focalY as fractions. NULL shows the whole photo.';

-- Without this PostgREST keeps serving from a schema cache that has never heard
-- of the column.
notify pgrst, 'reload schema';
