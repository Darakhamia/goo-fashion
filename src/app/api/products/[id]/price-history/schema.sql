-- Run once in Supabase SQL editor to enable price history + product reviews

-- Price history
create table if not exists public.price_history (
  id           uuid default gen_random_uuid() primary key,
  product_id   text not null references public.products(id) on delete cascade,
  retailer_name text,
  price        numeric(10,2) not null,
  currency     text default 'USD',
  recorded_at  timestamptz default now()
);
create index if not exists price_history_product_idx
  on public.price_history (product_id, recorded_at desc);

-- Auto-snapshot: insert a row whenever a product's price changes
-- (optional — run manually or via edge function)

-- Product reviews
create table if not exists public.product_reviews (
  id          uuid default gen_random_uuid() primary key,
  product_id  text not null references public.products(id) on delete cascade,
  user_id     text not null,
  user_name   text not null default 'Anonymous',
  rating      smallint not null check (rating between 1 and 5),
  text        text not null default '',
  is_approved boolean not null default false,
  created_at  timestamptz default now()
);
create index if not exists product_reviews_product_idx
  on public.product_reviews (product_id, created_at desc);
create unique index if not exists product_reviews_unique_user
  on public.product_reviews (product_id, user_id);

-- RLS: allow anyone to read approved reviews
alter table public.product_reviews enable row level security;
create policy "read approved reviews" on public.product_reviews
  for select using (is_approved = true);
create policy "insert own review" on public.product_reviews
  for insert with check (true);  -- auth check is done in the API route
