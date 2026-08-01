-- Post-restore sanity checks against the Coolify Postgres.
--
--   psql "$TARGET_DB_URL" -f scripts/migrate/verify.sql
--
-- Checks the things a plain row-count comparison misses: the extension the
-- catalog search depends on, the RPCs the app calls by name, the vector/FTS
-- indexes, and the role grants PostgREST needs.

\set ON_ERROR_STOP on

\echo '== Extensions =='
select extname, extversion from pg_extension where extname in ('vector', 'pg_trgm') order by extname;

\echo ''
\echo '== RPCs called from the app =='
-- Both come from supabase/migrations and must be present: the stylist calls
-- them by name for vector and full-text search.
select
  expected.name,
  case when p.proname is null then 'MISSING' else 'ok' end as status
from (values ('match_products'), ('search_products')) as expected(name)
left join pg_proc p
  on p.proname = expected.name
 and p.pronamespace = 'public'::regnamespace
order by expected.name;

\echo ''
\echo '== run_sql (absent is the healthy state) =='
-- /api/products/group calls run_sql, but it exists in no migration and was
-- absent from the production database too — that code path was already dead
-- before the migration. It only ever added three columns to products that the
-- schema has carried for a long time, so nothing depends on it.
--
-- Do not "fix" a MISSING here by creating it: an RPC that executes SQL handed
-- to it by a caller is a hole, and its absence is the safer state.
select
  case when count(*) = 0 then 'absent (expected)' else 'PRESENT - review it' end as status
from pg_proc
where proname = 'run_sql' and pronamespace = 'public'::regnamespace;

\echo ''
\echo '== Vector / FTS indexes =='
select
  expected.name,
  case when i.indexname is null then 'MISSING' else 'ok' end as status
from (values ('products_embedding_hnsw_idx'), ('products_fts_idx')) as expected(name)
left join pg_indexes i on i.indexname = expected.name and i.schemaname = 'public'
order by expected.name;

\echo ''
\echo '== Tables without a service_role grant (should be empty) =='
select c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not has_table_privilege('service_role', c.oid, 'SELECT')
order by c.relname;

\echo ''
\echo '== Rows still embedding a supabase.co Storage URL (should be 0) =='
select count(*) as products
from public.products
where image_url like '%.supabase.co/storage/%'
   or array_to_string(images, '') like '%.supabase.co/storage/%';

\echo ''
\echo '== Embedding coverage (stylist vector search degrades without it) =='
select
  count(*) as products,
  count(embedding) as with_embedding
from public.products;
