-- Grants PostgREST needs after a `--no-owner` restore.
--
-- The app talks to Postgres exclusively through PostgREST with the service role
-- key (src/lib/supabase.ts), and the public catalog is additionally readable by
-- `anon`. RLS policies come across in the dump, but a policy only narrows an
-- existing privilege — without these GRANTs every request fails with
-- "permission denied for table".
grant usage on schema public to anon, authenticated, service_role;

grant select                         on all tables    in schema public to anon, authenticated;
grant all privileges                 on all tables    in schema public to service_role;
grant usage, select                  on all sequences in schema public to anon, authenticated, service_role;
grant execute                        on all functions in schema public to anon, authenticated, service_role;

-- Same treatment for anything created later (new migrations run as `postgres`).
alter default privileges in schema public grant select        on tables    to anon, authenticated;
alter default privileges in schema public grant all privileges on tables    to service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute       on functions to anon, authenticated, service_role;
