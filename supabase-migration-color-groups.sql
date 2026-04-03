-- ============================================================
-- Migration: Color Groups for filter sidebar
-- Run this in Supabase SQL Editor if you get the error:
-- "Could not find the 'color_group_ids' column of 'products'"
-- ============================================================

-- 1. Create color_groups table
create table if not exists public.color_groups (
  id         serial      primary key,
  name       text        not null,
  hex_code   text        not null,
  sort_order int         not null default 0
);

alter table public.color_groups enable row level security;

create policy if not exists "Public read access"
  on public.color_groups
  for select
  using (true);

-- 2. Seed standard colors
insert into public.color_groups (name, hex_code, sort_order) values
  ('White',      '#ffffff',      1),
  ('Multicolor', '#multicolor',  2),
  ('Brown',      '#7a4f35',      3),
  ('Pink',       '#e8698a',      4),
  ('Yellow',     '#f5c518',      5),
  ('Orange',     '#e87722',      6),
  ('Grey',       '#808080',      7),
  ('Black',      '#111111',      8),
  ('Green',      '#2d6a3f',      9),
  ('Red',        '#c0392b',      10),
  ('Violet',     '#7b3fa0',      11),
  ('Blue',       '#1a47a0',      12),
  ('Beige',      '#d4c5a9',      13)
on conflict do nothing;

-- 3. Add color_group_ids column to products
alter table public.products
  add column if not exists color_group_ids int[] not null default '{}';

-- 4. Index for fast filtering
create index if not exists products_color_group_ids_idx
  on public.products using gin (color_group_ids);
