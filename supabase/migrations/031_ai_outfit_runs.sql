-- Migration 031: outfits put together by the AI, and the runs that made them.
--
-- By the CEO's request of 2026-10-27 the studio can ask the AI for outfits:
-- it picks pieces from the catalogue that go together (colour, style, gender,
-- season), names and describes each outfit, draws its picture, and puts it in
-- the moderation queue (Outfits → Pending) like a shopper's submission. An
-- admin approves or rejects it as usual; an approved one is marked AI on the
-- site (src/lib/server/ai-outfits, AI_ARCHITECTURE.md).
--
--   pending_looks.ai_meta jsonb
--     null for a shopper's submission. For a generated look: the run it came
--     from, the model, its note to the moderator on why the pieces go
--     together, the palette, the brief, what was changed in its words and
--     why, and why its picture failed if it did. Approval reads it to mark
--     the outfit AI.
--
--   ai_outfit_runs
--     one row per run: who started it, the brief, how many outfits were asked
--     for and made, the log the studio shows while it runs, and what the
--     model calls cost. A run takes minutes (one picture per outfit), so the
--     studio follows it here rather than waiting on one request.
--
-- Without this file the site works as before; only the "Generate with AI"
-- button answers that the migration is missing.
--
-- Changes no existing data. Idempotent: safe to re-run.

alter table if exists public.pending_looks
  add column if not exists ai_meta jsonb;

create table if not exists public.ai_outfit_runs (
  id          uuid        primary key default gen_random_uuid(),
  created_by  text        not null,
  brief       jsonb       not null default '{}',
  status      text        not null default 'running',  -- running | done | failed
  requested   integer     not null default 0,
  made        integer     not null default 0,
  failed      integer     not null default 0,
  log         jsonb       not null default '[]',        -- [{ at, message }]
  cost_usd    numeric     not null default 0,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ai_outfit_runs_created_at_idx on public.ai_outfit_runs (created_at desc);

-- Read and written by the service role only, like the other studio tables.
alter table public.ai_outfit_runs enable row level security;

notify pgrst, 'reload schema';
