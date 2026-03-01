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
