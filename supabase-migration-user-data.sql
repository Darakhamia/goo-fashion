-- User likes (liked outfits and products)
create table if not exists public.user_likes (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  entity_type text not null check (entity_type in ('outfit', 'product')),
  entity_id   text not null,
  created_at  timestamptz default now(),
  unique(user_id, entity_type, entity_id)
);

alter table public.user_likes enable row level security;

create index if not exists user_likes_user_idx on public.user_likes (user_id);

-- User saved looks (builder-created outfits)
create table if not exists public.user_looks (
  id               text primary key,
  user_id          text not null,
  saved_at         timestamptz default now(),
  pieces           jsonb not null default '[]',
  total_price      numeric,
  style_keywords   text[],
  generated_image  text,
  generated_style  jsonb
);

alter table public.user_looks enable row level security;

create index if not exists user_looks_user_idx on public.user_looks (user_id);
create index if not exists user_looks_saved_at_idx on public.user_looks (user_id, saved_at desc);
