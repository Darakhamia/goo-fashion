-- Daily stylist message usage tracking per user
-- Run this in Supabase SQL editor or via the CLI

create table if not exists public.stylist_daily_usage (
  user_id    text    not null,
  usage_date date    not null default current_date,
  count      integer not null default 0,
  primary key (user_id, usage_date)
);

-- Allow the service role (server-side API) full access
alter table public.stylist_daily_usage enable row level security;

create policy "service role full access"
  on public.stylist_daily_usage
  for all
  to service_role
  using (true)
  with check (true);
