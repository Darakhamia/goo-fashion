-- Migration 024: The settings table.
--
-- One key/value row per setting: the OpenAI key (when it is not set in the
-- environment), the prompt overrides edited under Prompts, the parser
-- configuration, the homepage showcases and hero image picked in the studio,
-- and the email templates. Every reader of it falls back to a default or fails
-- to save when the table is missing, so on a fresh database half of the studio
-- looked configured and quietly did nothing.
--
-- The DDL used to live only as text on the Settings page. It is the same
-- table, so a database that already has it is left exactly as it is.
--
-- Idempotent: safe to re-run.

create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;
-- No public policy: the table can hold the OpenAI key. Only the server reads
-- and writes it, with the service role key, which bypasses RLS.

notify pgrst, 'reload schema';
