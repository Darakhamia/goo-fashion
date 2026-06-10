-- Link publication submissions back to the user's saved look so the saved
-- page can show per-look publication status (pending / approved / rejected).
alter table public.pending_looks
  add column if not exists look_id text;

create index if not exists pending_looks_user_idx
  on public.pending_looks (user_id, created_at desc);
