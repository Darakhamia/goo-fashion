-- Migration 025: AI check of the catalogue.
--
-- A cheap model reads every product record as it is stored — name, brand,
-- category, gender, colours, material, sizes, description, stores — next to
-- the catalogue's own brand spellings and category tree, and says what
-- contradicts what. The server checks each answer against the record and the
-- tree before anything is written (see src/lib/server/catalogue-check), so the
-- model never writes to the database itself.
--
-- Three things are stored:
--
--   products.catalogue_fingerprint / catalogue_checked_at
--     What the record looked like when it was last checked. A product whose
--     fingerprint is empty has never been checked; one whose fields no longer
--     hash to it has changed since (a re-collect, an edit) and is due again.
--     Nothing else reads these columns.
--
--   catalogue_check_fixes
--     Every change the check made or proposed, with the columns before and
--     after, the model's reason and how sure it was. An applied fix can be
--     undone from here; an undone or dismissed one is remembered, so the same
--     claim about the same product is never raised again.
--
--   catalogue_check_runs
--     One row per run: how many products, how many fixes, the tokens spent and
--     what they cost, so the spend is visible rather than estimated.
--
-- Idempotent: safe to re-run.

alter table public.products
  add column if not exists catalogue_fingerprint text,
  add column if not exists catalogue_checked_at  timestamptz;

create index if not exists products_catalogue_unchecked_idx
  on public.products (created_at desc)
  where catalogue_fingerprint is null;

create table if not exists public.catalogue_check_runs (
  id             text        primary key,
  trigger        text        not null default 'manual',  -- 'manual', 'auto', 'brands'
  model          text        not null default '',
  admin_id       text,
  products       integer     not null default 0,
  applied        integer     not null default 0,
  suggested      integer     not null default 0,
  failed         integer     not null default 0,
  input_tokens   bigint      not null default 0,
  cached_tokens  bigint      not null default 0,
  output_tokens  bigint      not null default 0,
  cost_usd       numeric     not null default 0,
  started_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists catalogue_check_runs_started_idx
  on public.catalogue_check_runs (started_at desc);

create table if not exists public.catalogue_check_fixes (
  id           bigserial   primary key,
  run_id       text        not null,
  product_id   text        not null references public.products (id) on delete cascade,
  field        text        not null,           -- 'brand', 'name', 'subcategory', 'gender', 'colors', …
  before       jsonb       not null default '{}',  -- the columns as they were
  after        jsonb       not null default '{}',  -- the columns as the fix writes them
  reason       text        not null default '',
  confidence   text        not null default 'medium',  -- 'high', 'medium'
  status       text        not null default 'suggested',
  -- 'applied'   written to the product
  -- 'suggested' waiting for an admin
  -- 'undone'    applied, then reverted by an admin — never proposed again
  -- 'dismissed' rejected by an admin — never proposed again
  -- 'stale'     the product changed before anyone decided
  source       text        not null default 'product', -- 'product' or 'brand'
  model        text        not null default '',
  decided_by   text,
  decided_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists catalogue_check_fixes_status_idx
  on public.catalogue_check_fixes (status, created_at desc);
create index if not exists catalogue_check_fixes_product_idx
  on public.catalogue_check_fixes (product_id);
create index if not exists catalogue_check_fixes_run_idx
  on public.catalogue_check_fixes (run_id);

alter table public.catalogue_check_runs  enable row level security;
alter table public.catalogue_check_fixes enable row level security;
-- No public policies: admin bookkeeping, reached only through the service role
-- key server-side.

notify pgrst, 'reload schema';
