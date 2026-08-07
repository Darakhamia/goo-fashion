-- Migration 011: Move the catalog's category tree into the database.
--
-- The tree lived in src/lib/categories.ts, so adding "Loafers" under Footwear
-- meant editing code and redeploying. The catalog grows faster than that, so
-- the groups and their subcategories now live in two tables the admin panel
-- edits directly. The hardcoded tree stays in the code as the fallback for a
-- database that has not run this migration.
--
-- A product still stores two things: `category`, the fixed bucket the rest of
-- the code filters and classifies on, and `subcategory`, the label naming
-- which kind it is inside that bucket. That is why a subcategory row carries
-- a `value` — it is the `products.category` that picking this label writes.

create table if not exists public.category_groups (
  id         text primary key,   -- 'footwear'; also the ?category= value in URLs
  label      text not null,      -- 'Footwear'
  sort_order int  not null default 0
);

create table if not exists public.category_subcategories (
  id         serial primary key,
  group_id   text not null references public.category_groups (id) on delete cascade,
  label      text not null,      -- 'Sneakers' — what products.subcategory stores
  value      text not null,      -- 'footwear' — what products.category stores
  sort_order int  not null default 0,
  -- Products record the label as plain text, and the label resolves back to a
  -- category value through one flat map, so the same label in two groups
  -- would be ambiguous in both directions. Unique across the tree, not per
  -- group.
  unique (label)
);

create index if not exists category_subcategories_group_idx
  on public.category_subcategories (group_id, sort_order);

alter table public.category_groups        enable row level security;
alter table public.category_subcategories enable row level security;

-- Public read: the storefront filters render this tree. Writes go through the
-- admin API with the service role key, which bypasses RLS.
drop policy if exists "Public read access" on public.category_groups;
create policy "Public read access" on public.category_groups for select using (true);

drop policy if exists "Public read access" on public.category_subcategories;
create policy "Public read access" on public.category_subcategories for select using (true);

-- Seed with the tree that was hardcoded, so the catalog looks identical the
-- moment this runs.
insert into public.category_groups (id, label, sort_order) values
  ('outerwear',   'Outerwear',   1),
  ('tops',        'Tops',        2),
  ('bottoms',     'Bottoms',     3),
  ('dresses',     'Dresses',     4),
  ('footwear',    'Footwear',    5),
  ('accessories', 'Accessories', 6)
on conflict (id) do nothing;

insert into public.category_subcategories (group_id, label, value, sort_order) values
  ('outerwear',   'Jackets',               'outerwear',   1),
  ('outerwear',   'Coats',                 'outerwear',   2),
  ('outerwear',   'Parkas',                'outerwear',   3),
  ('outerwear',   'Vests',                 'outerwear',   4),
  ('outerwear',   'Bomber Jackets',        'outerwear',   5),
  ('outerwear',   'Raincoats',             'outerwear',   6),
  ('outerwear',   'Blazers',               'blazers',     7),
  ('tops',        'T-Shirts',              'tops',        1),
  ('tops',        'Hoodies & Sweatshirts', 'tops',        2),
  ('tops',        'Shirts',                'shirts',      3),
  ('tops',        'Knitwear',              'knitwear',    4),
  ('bottoms',     'Pants',                 'bottoms',     1),
  ('bottoms',     'Jeans',                 'jeans',       2),
  ('bottoms',     'Shorts',                'shorts',      3),
  ('bottoms',     'Skirts',                'skirts',      4),
  ('dresses',     'Dresses',               'dresses',     1),
  ('dresses',     'Jumpsuits',             'jumpsuits',   2),
  ('footwear',    'Sneakers',              'footwear',    1),
  ('footwear',    'Sandals',               'footwear',    2),
  ('footwear',    'Boots',                 'footwear',    3),
  ('accessories', 'Bags',                  'bags',        1),
  ('accessories', 'Hats',                  'accessories', 2),
  ('accessories', 'Belts',                 'accessories', 3),
  ('accessories', 'Sunglasses',            'accessories', 4),
  ('accessories', 'Watches',               'accessories', 5)
on conflict (label) do nothing;

-- PostgREST answers from a cached schema and would not see the new tables.
notify pgrst, 'reload schema';
