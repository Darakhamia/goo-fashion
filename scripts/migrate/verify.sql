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
-- match_products + search_products come from supabase/migrations; run_sql was
-- created by hand in the Supabase SQL editor and exists in no migration file,
-- so it only survives if the database was moved with pg_dump rather than by
-- replaying the repo's migrations.
select
  expected.name,
  case when p.proname is null then 'MISSING' else 'ok' end as status
from (values ('match_products'), ('search_products'), ('run_sql')) as expected(name)
left join pg_proc p
  on p.proname = expected.name
 and p.pronamespace = 'public'::regnamespace
order by expected.name;

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
