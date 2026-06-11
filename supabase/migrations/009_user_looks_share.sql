-- Public sharing of user-created looks.
--
-- The /look/[id] page and POST /api/user/looks both rely on the user_looks
-- table carrying an optional name/description. Ensure the table and those
-- columns exist so sharing a look never fails to persist (which would surface
-- as a 404 when the recipient opens the link). Idempotent: safe to re-run.

create table if not exists public.user_looks (
  id               text primary key,
  user_id          text not null,
  saved_at         timestamptz default now(),
  pieces           jsonb not null default '[]',
  total_price      numeric,
  style_keywords   text[],
  generated_image  text,
  generated_style  jsonb
);

alter table public.user_looks
  add column if not exists look_name        text,
  add column if not exists look_description text;

alter table public.user_looks enable row level security;

create index if not exists user_looks_user_idx on public.user_looks (user_id);
create index if not exists user_looks_saved_at_idx on public.user_looks (user_id, saved_at desc);
