-- CI only — never run against a real database.
--
-- Tables the live database has that no file in this repository creates: they
-- were made in the Supabase dashboard before supabase/migrations existed.
-- Migrations 008 and 017 alter `pending_looks`, so without it the chain cannot
-- be built from scratch and CI could not check it. The columns are the ones the
-- code writes (src/app/api/looks/*); the migrations add the rest.
--
-- Replace this file with the baseline schema dump once there is one
-- (docs/CODE_REVIEW_2026-09.md, "baseline-миграция").

create table if not exists public.pending_looks (
  id              uuid        primary key default gen_random_uuid(),
  user_id         text        not null,
  generated_image text,
  generated_style text,
  pieces          jsonb       not null default '[]',
  total_price     numeric,
  style_keywords  text[]      not null default '{}',
  status          text        not null default 'pending',
  outfit_id       text,
  created_at      timestamptz not null default now()
);
