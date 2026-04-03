-- ============================================================
-- GOO Fashion — Supabase Products Table
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- ============================================================

create table if not exists public.products (
  id            text        primary key default gen_random_uuid()::text,
  name          text        not null,
  brand         text        not null default '',
  category      text        not null default '',
  description   text        not null default '',
  image_url     text        not null default '',
  images        text[]      not null default '{}',
  colors        text[]      not null default '{}',
  color_images  jsonb                default null,
  sizes         text[]      not null default '{}',
  material      text        not null default '',
  retailers     jsonb       not null default '[]',
  price_min     numeric     not null default 0,
  price_max     numeric     not null default 0,
  currency      text        not null default 'USD',
  is_new        boolean     not null default false,
  is_saved      boolean     not null default false,
  style_keywords text[]     not null default '{}',
  gender        text                 default null,
  created_at    timestamptz not null default now()
);

-- Migration: add gender column if upgrading an existing table
-- alter table public.products add column if not exists gender text default null;

-- ============================================================
-- Migration: Color variant linking (run in Supabase SQL Editor)
-- ============================================================
-- alter table public.products add column if not exists variant_group_id text default null;
-- alter table public.products add column if not exists color_hex         text default null;
-- alter table public.products add column if not exists is_group_primary  boolean default false;
--
-- -- Index for fast group lookups
-- create index if not exists products_variant_group_idx on public.products (variant_group_id)
--   where variant_group_id is not null;
-- ============================================================

-- Enable Row Level Security
alter table public.products enable row level security;

-- Allow anyone to read products (public catalog)
create policy "Public read access"
  on public.products
  for select
  using (true);

-- Only service role (server-side API) can insert/update/delete
-- (No additional policies needed — service role bypasses RLS)

-- Optional: index for category filtering
create index if not exists products_category_idx on public.products (category);
create index if not exists products_brand_idx    on public.products (brand);
create index if not exists products_created_at_idx on public.products (created_at desc);

-- ============================================================
-- Brands table (used by admin Brand Manager)
-- ============================================================

create table if not exists public.brands (
  id   serial primary key,
  name text   unique not null
);

alter table public.brands enable row level security;

-- Allow anyone to read brands
create policy "Public read access"
  on public.brands
  for select
  using (true);

-- Pre-populate with default brands (safe to run multiple times)
insert into public.brands (name) values
  ('Acne Studios'), ('Arket'), ('& Other Stories'), ('A.P.C.'),
  ('Balenciaga'), ('Bottega Veneta'), ('Burberry'), ('Cos'),
  ('Fear of God'), ('Gucci'), ('Jacquemus'), ('Jil Sander'),
  ('Lemaire'), ('Louis Vuitton'), ('Maison Margiela'), ('Massimo Dutti'),
  ('Miu Miu'), ('Nike'), ('Prada'), ('Sandro'), ('The Row'),
  ('Toteme'), ('Valentino'), ('Zara')
on conflict (name) do nothing;

alter table public.products
  add column if not exists variant_group_id text    default null,
  add column if not exists color_hex        text    default null,
  add column if not exists is_group_primary boolean default false;

create index if not exists products_variant_group_idx
  on public.products (variant_group_id)
  where variant_group_id is not null;

-- ============================================================
-- Color Groups (Base Color Mapping for filter sidebar)
-- ============================================================

create table if not exists public.color_groups (
  id         serial      primary key,
  name       text        not null,        -- "Черный", "Белый", "Красный"
  hex_code   text        not null,        -- "#000000" — used for swatch circle in filter UI
  sort_order int         not null default 0
);

alter table public.color_groups enable row level security;

create policy "Public read access"
  on public.color_groups
  for select
  using (true);

-- Pre-populate with standard base colors
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

-- ============================================================
-- Migration: add color_group_ids array to products
-- Stores IDs from color_groups; supports multi-color items
-- ============================================================
-- alter table public.products
--   add column if not exists color_group_ids int[] not null default '{}';
--
-- create index if not exists products_color_group_ids_idx
--   on public.products using gin (color_group_ids);

alter table public.products
  add column if not exists color_group_ids int[] not null default '{}';

create index if not exists products_color_group_ids_idx
  on public.products using gin (color_group_ids);
