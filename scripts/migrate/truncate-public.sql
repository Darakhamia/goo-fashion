-- Empties every table in `public` so the data pass can be re-run without
-- double-loading.
--
-- The data pass is COPY, which appends. A restore that dies partway (a
-- permissions error, a bad row, a dropped connection) leaves the tables it
-- already finished populated, and simply running the script again silently
-- doubles those rows. Clearing first makes the restore idempotent.
--
-- Destructive by design, and only ever correct against a target being
-- populated from a dump — never against a database already serving traffic.
do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public' order by tablename
  loop
    execute format('truncate table public.%I cascade', t.tablename);
  end loop;
end $$;
