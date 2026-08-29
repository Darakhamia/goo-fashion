-- Step 4 of the Coolify migration — repoint stored public Storage URLs at the
-- new host.
--
-- Every image the app persists is an absolute URL built by getPublicUrl(), so
-- the old project ref is baked into product rows, outfits, blog posts, brand
-- logos and admin settings. Copying the bytes (migrate-storage.mjs) is not
-- enough — without this the catalog keeps loading images from the dead project.
--
-- The path layout is identical on both sides
-- (<host>/storage/v1/object/public/<bucket>/<key>), so only the host changes.
--
--   psql "$TARGET_DB_URL" \
--     -v old_host='https://abcdefgh.supabase.co' \
--     -v new_host='https://supabase.example.com' \
--     -f scripts/migrate/rewrite-storage-urls.sql
--
-- Wrapped in a transaction: review the per-column report, then commit.

\set ON_ERROR_STOP on
begin;

-- psql does not interpolate :vars inside dollar-quoted bodies, so hand them to
-- the DO block through session settings instead.
select set_config('migrate.old_host', :'old_host', true);
select set_config('migrate.new_host', :'new_host', true);

do $$
declare
  old_host text := current_setting('migrate.old_host');
  new_host text := current_setting('migrate.new_host');
  col      record;
  updated  bigint;
  total    bigint := 0;
begin
  if old_host = '' or new_host = '' then
    raise exception 'old_host and new_host must both be set';
  end if;

  -- Rather than hardcoding the ~10 known image columns (which drift as tables
  -- are added), sweep every writable text / text[] / json column in `public`.
  -- Each UPDATE is guarded by a LIKE on the old host, so rows without a
  -- Supabase URL are never touched.
  for col in
    select c.table_name, c.column_name, c.udt_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.is_generated = 'NEVER'
      and c.is_updatable = 'YES'
      and c.udt_name in ('text', 'varchar', '_text', 'json', 'jsonb')
    order by c.table_name, c.column_name
  loop
    if col.udt_name in ('text', 'varchar') then
      execute format(
        'update public.%I set %I = replace(%I, %L, %L) where %I like %L',
        col.table_name, col.column_name, col.column_name, old_host, new_host,
        col.column_name, '%' || old_host || '%');

    elsif col.udt_name = '_text' then
      execute format(
        'update public.%I set %I = (
           select array_agg(replace(elem, %L, %L) order by ord)
           from unnest(%I) with ordinality as u(elem, ord)
         )
         where array_to_string(%I, '''') like %L',
        col.table_name, col.column_name, old_host, new_host, col.column_name,
        col.column_name, '%' || old_host || '%');

    else -- json / jsonb: rewrite the serialized form, then cast back
      execute format(
        'update public.%I set %I = replace(%I::text, %L, %L)::%s where %I::text like %L',
        col.table_name, col.column_name, col.column_name, old_host, new_host,
        col.udt_name, col.column_name, '%' || old_host || '%');
    end if;

    get diagnostics updated = row_count;
    if updated > 0 then
      raise notice '% .% -> % row(s)', col.table_name, col.column_name, updated;
      total := total + updated;
    end if;
  end loop;

  raise notice 'Rewrote % row(s) in total.', total;
end $$;

-- Nothing should be left pointing at the old host.
select count(*) as products_still_on_old_host
from public.products
where image_url like '%' || current_setting('migrate.old_host') || '%'
   or array_to_string(images, '') like '%' || current_setting('migrate.old_host') || '%';

commit;
