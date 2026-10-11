-- Migration 026: migrations apply themselves on deploy.
--
-- Until now every file in supabase/migrations was pasted into the Supabase SQL
-- editor by hand after the code that needed it had already shipped — and a
-- forgotten one cost a feature silently (see Settings → Database schema).
--
-- From here on, every deploy runs `scripts/migrate.mjs` before the site starts.
-- It reads the numbered files in this folder, asks the database which ones it
-- has recorded in `schema_migrations`, and sends each missing one, in file
-- order, to `goo_apply_migration` below. The site and the database live on
-- different servers; the call goes over the same HTTPS API (PostgREST behind
-- Kong) the site already uses for every read and write, with the same
-- service-role key, so no database port has to be opened between them.
--
-- THIS FILE IS THE LAST ONE RUN BY HAND. Paste it into the SQL editor once.
-- Everything after it — 027 onwards — is applied by the deploy.
--
-- What it does:
--   1. `schema_migrations`: one row per file the database has applied.
--   2. `goo_apply_migration(name, sql, checksum)`: runs one file's SQL and
--      records it, in one transaction — a file that fails leaves nothing
--      half-applied and is not recorded, so the next deploy tries it again.
--      Callable by the service role only.
--   3. Records 001–024 as already applied on a database that has the catalogue
--      (a live one, migrated by hand until now) — but first checks that each of
--      them really left its mark (a table, a column, a function). If any did
--      not, the file stops before creating anything and names them: apply those
--      by hand, one at a time in number order, then run this file again. A file
--      recorded as applied is never run by the deploy, so recording one that
--      is not would hide it for good. 025 is left for the first deploy to
--      apply: it is idempotent, so on a database that already has it it
--      changes nothing — and it proves the deploy path works.
--   4. Takes EXECUTE on the old `run_sql` function (if it is still there) away
--      from anon, authenticated and PUBLIC. Nothing in the code has called it
--      since September 2026, and a function that runs any SQL it is given must
--      not be callable with the anon key.
--
-- Idempotent: safe to re-run.
--
-- CI builds its database from scratch and wants every file to go through the
-- deploy path, so it runs this with `PGOPTIONS='-c goo.migration_baseline=skip'`:
-- no check, nothing recorded but this file.

-- 0. Before anything is created: on a live database, did 001–024 all run?
do $$
declare
  missing text[] := '{}';
  m       record;
begin
  if coalesce(current_setting('goo.migration_baseline', true), '') = 'skip'
     or to_regclass('public.products') is null then
    return;
  end if;

  -- Tables a migration created.
  if to_regclass('public.page_views')             is null then missing := array_append(missing, '001_analytics.sql (page_views)'); end if;
  if to_regclass('public.blog_posts')             is null then missing := array_append(missing, '002_blog.sql (blog_posts)'); end if;
  if to_regclass('public.stylist_daily_usage')    is null then missing := array_append(missing, '003_stylist_usage.sql (stylist_daily_usage)'); end if;
  if not exists (select 1 from pg_extension where extname = 'vector')
                                                         then missing := array_append(missing, '005_product_embeddings.sql (extension vector)'); end if;
  if to_regclass('public.category_subcategories') is null then missing := array_append(missing, '011_category_tree.sql (category_subcategories)'); end if;
  if to_regclass('public.label_audit_dismissals') is null then missing := array_append(missing, '012_label_audit_dismissals.sql (label_audit_dismissals)'); end if;
  if to_regclass('public.retailer_domains')       is null then missing := array_append(missing, '018_retailer_domains.sql (retailer_domains)'); end if;
  if to_regclass('public.settings')               is null then missing := array_append(missing, '024_settings.sql (settings)'); end if;

  -- Columns a migration added.
  for m in
    select * from (values
      ('004_import_tables.sql',            'products',               'source_url'),
      ('006_product_fts.sql',              'products',               'fts'),
      ('008_pending_looks_look_id.sql',    'pending_looks',          'look_id'),
      ('009_user_looks_share.sql',         'user_looks',             'look_name'),
      ('010_product_subcategory.sql',      'products',               'subcategory'),
      ('013_subcategory_sizes.sql',        'category_subcategories', 'sizes'),
      ('015_product_bg_color.sql',         'products',               'bg_color'),
      ('017_pending_look_details.sql',     'pending_looks',          'name'),
      ('019_product_price_usd.sql',        'products',               'price_min_usd'),
      ('019_product_source_price.sql',     'products',               'source_price'),
      ('020_product_codes.sql',            'products',               'gtin'),
      ('021_color_groups.sql',             'products',               'color_group_ids'),
      ('022_retailer_default_gender.sql',  'retailer_domains',       'default_gender'),
      ('023_product_crop_data.sql',        'products',               'crop_data')
    ) as v(migration, tbl, col)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = m.tbl and column_name = m.col
    ) then
      missing := array_append(missing, format('%s (%s.%s)', m.migration, m.tbl, m.col));
    end if;
  end loop;

  -- 007 re-made the embedding column at 1536 dimensions; 014 gave search a gender filter.
  -- By type name and dimension rather than format_type(): Supabase keeps vector
  -- in the `extensions` schema, which format_type() would print as a prefix.
  if not exists (
    select 1 from pg_attribute a join pg_type t on t.oid = a.atttypid
    where a.attrelid = 'public.products'::regclass and a.attname = 'embedding' and not a.attisdropped
      and t.typname = 'vector' and a.atttypmod = 1536
  ) then
    missing := array_append(missing, '007_embeddings_openai_1536.sql (products.embedding vector(1536))');
  end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_products' and 'filter_gender' = any(p.proargnames)
  ) then
    missing := array_append(missing, '014_product_search_gender_filter.sql (search_products with filter_gender)');
  end if;
  -- 016 only re-labels blog rows and leaves nothing to look for.

  if array_length(missing, 1) > 0 then
    raise exception using
      message = 'Automatic migrations are not switched on: this database is missing ' || array_length(missing, 1) || ' earlier migration(s): ' || array_to_string(missing, '; '),
      hint = 'Apply those files by hand, one at a time in number order (Settings → Database schema lists them too), then run 026_migration_runner.sql again. Nothing was created.';
  end if;
end $$;

create table if not exists public.schema_migrations (
  name       text        primary key,          -- the file name, e.g. '027_something.sql'
  checksum   text        not null default '',  -- sha256 of the file as applied
  applied_by text        not null default 'deploy', -- 'deploy', 'baseline'
  applied_at timestamptz not null default now()
);

alter table public.schema_migrations enable row level security;
-- No public policies: read and written by the service role only.

create or replace function public.goo_apply_migration(p_name text, p_sql text, p_checksum text default '')
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_name !~ '^[0-9]{3}_[a-z0-9_]+\.sql$' then
    raise exception 'not a migration file name: %', p_name;
  end if;

  -- Two deploys at once (a restart during a deploy) take turns.
  perform pg_advisory_xact_lock(hashtext('goo_apply_migration'));

  if exists (select 1 from public.schema_migrations where name = p_name) then
    return 'already applied';
  end if;

  execute p_sql;

  insert into public.schema_migrations (name, checksum, applied_by)
  values (p_name, coalesce(p_checksum, ''), 'deploy');

  -- So the API sees new tables, columns and functions straight away.
  perform pg_notify('pgrst', 'reload schema');
  return 'applied';
end;
$$;

-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default. This one runs arbitrary SQL, so only the service role keeps it.
revoke all on function public.goo_apply_migration(text, text, text) from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function public.goo_apply_migration(text, text, text) from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.goo_apply_migration(text, text, text) to service_role;
    grant select, insert, update, delete on public.schema_migrations to service_role;
  end if;
end $$;

-- The files a live database already has, applied by hand before this one
-- (checked at the top of this file).
insert into public.schema_migrations (name, applied_by)
select v.name, 'baseline'
from (values
  ('001_analytics.sql'),
  ('002_blog.sql'),
  ('003_stylist_usage.sql'),
  ('004_import_tables.sql'),
  ('005_product_embeddings.sql'),
  ('006_product_fts.sql'),
  ('007_embeddings_openai_1536.sql'),
  ('008_pending_looks_look_id.sql'),
  ('009_user_looks_share.sql'),
  ('010_product_subcategory.sql'),
  ('011_category_tree.sql'),
  ('012_label_audit_dismissals.sql'),
  ('013_subcategory_sizes.sql'),
  ('014_product_search_gender_filter.sql'),
  ('015_product_bg_color.sql'),
  ('016_blog_category_retag.sql'),
  ('017_pending_look_details.sql'),
  ('018_retailer_domains.sql'),
  ('019_product_price_usd.sql'),
  ('019_product_source_price.sql'),
  ('020_product_codes.sql'),
  ('021_color_groups.sql'),
  ('022_retailer_default_gender.sql'),
  ('023_product_crop_data.sql'),
  ('024_settings.sql')
) as v(name)
where to_regclass('public.products') is not null
  and coalesce(current_setting('goo.migration_baseline', true), '') <> 'skip'
on conflict (name) do nothing;

-- This file itself, so the deploy never tries to run it.
insert into public.schema_migrations (name, applied_by)
values ('026_migration_runner.sql', 'baseline')
on conflict (name) do nothing;

-- The old any-SQL function, if it survives, no longer answers the anon key.
do $$
declare f regprocedure; r text;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'run_sql'
  loop
    execute format('revoke all on function %s from public', f);
    foreach r in array array['anon', 'authenticated'] loop
      if exists (select 1 from pg_roles where rolname = r) then
        execute format('revoke all on function %s from %I', f, r);
      end if;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
