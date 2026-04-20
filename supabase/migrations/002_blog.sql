-- ============================================================================
-- Blog posts table for /blog + /admin/blog
-- Run this in Supabase SQL editor once.
-- ============================================================================

create table if not exists public.blog_posts (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  title             text not null,
  excerpt           text not null default '',
  body              text not null default '',        -- HTML
  category          text not null default 'General',
  cover_image_url   text not null default '',
  read_time         text not null default '5 min',
  author_name       text not null default 'GOO',
  -- SEO
  meta_title        text,
  meta_description  text,
  og_image          text,
  -- Lifecycle
  is_published      boolean not null default true,
  published_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists blog_posts_slug_idx         on public.blog_posts (slug);
create index if not exists blog_posts_published_at_idx on public.blog_posts (published_at desc);
create index if not exists blog_posts_is_published_idx on public.blog_posts (is_published);
create index if not exists blog_posts_category_idx     on public.blog_posts (category);

-- Auto-update updated_at on any UPDATE.
create or replace function public.blog_posts_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists blog_posts_touch_updated_at on public.blog_posts;
create trigger blog_posts_touch_updated_at
  before update on public.blog_posts
  for each row execute function public.blog_posts_touch_updated_at();

-- RLS on; service-role key (server) bypasses. No policies = anon/authenticated
-- clients cannot read/write directly. Public reads go through our API.
alter table public.blog_posts enable row level security;
