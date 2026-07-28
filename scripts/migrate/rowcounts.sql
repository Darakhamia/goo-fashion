-- Exact row count per table in `public`, used to compare source and target
-- after the restore. pg_stat_user_tables.n_live_tup is only an estimate and
-- drifts until autovacuum catches up, which makes it useless as a check right
-- after a bulk load — query_to_xml runs a real count(*) per table instead.
select
  table_name,
  (xpath('/row/cnt/text()', xml_count))[1]::text::bigint as rows
from (
  select
    c.relname as table_name,
    query_to_xml(format('select count(*) as cnt from public.%I', c.relname), false, true, '') as xml_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
) t
order by table_name;
