-- ============================================================
-- GOO Fashion — Product URL Importer
-- Adds status/source_url/ai_tags to products,
-- and creates the import_jobs tracking table.
-- ============================================================

-- Extend products table
alter table public.products
  add column if not exists status     text        not null default 'published',
  add column if not exists source_url text,
  add column if not exists ai_tags    text[]      not null default '{}';

-- Unique index on source_url (nulls are not considered equal, so multiple NULLs are fine)
create unique index if not exists products_source_url_idx
  on public.products (source_url)
  where source_url is not null;

-- Note: the API uses select→insert/update instead of ON CONFLICT to avoid
-- PostgREST limitations with partial indexes. This index still prevents duplicates at the DB level.

-- ── Import jobs ──────────────────────────────────────────────
create table if not exists public.import_jobs (
  id                uuid        primary key default gen_random_uuid(),
  url               text        not null,
  status            text        not null default 'pending',   -- pending | processing | done | failed
  error             text,
  result_product_id text        references public.products(id) on delete set null,
  created_at        timestamptz not null default now()
);

alter table public.import_jobs enable row level security;
-- Only service role (server-side) can access import_jobs — no public policies needed.

create index if not exists import_jobs_created_at_idx
  on public.import_jobs (created_at desc);
