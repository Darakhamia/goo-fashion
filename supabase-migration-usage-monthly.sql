-- Monthly usage counters — what makes the quotas on /plans real.
--
-- One row per user per calendar month (UTC). Until this existed the pricing
-- page sold "50 / 180 / 450 generations a month" against no counter at all, so
-- a Basic subscriber could generate without limit at roughly $0.067 an image.
--
-- Run in the Supabase SQL editor.

create table if not exists usage_monthly (
  user_id       text        not null,           -- Clerk user id
  period        text        not null,           -- 'YYYY-MM', UTC
  images_used   integer     not null default 0,
  messages_used integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, period)
);

-- Admin views read "this month, everyone".
create index if not exists usage_monthly_period_idx on usage_monthly (period);

/*
 * Atomic increment.
 *
 * A read-then-write from the application would let concurrent requests both
 * read the same count and both write count+1, which is exactly how a script
 * gets past a quota. Doing it in one statement means the database serialises
 * the increments, and the returned value is the caller's true position — so the
 * caller can reserve a slot and refuse the request when the value comes back
 * over the limit.
 *
 * Negative deltas are allowed so a reserved slot can be released when the
 * generation itself fails; greatest(...) keeps a release from driving the
 * counter below zero.
 */
create or replace function increment_usage(
  p_user_id  text,
  p_period   text,
  p_images   integer default 0,
  p_messages integer default 0
)
returns table (images_used integer, messages_used integer)
language plpgsql
as $$
begin
  return query
  insert into usage_monthly as u (user_id, period, images_used, messages_used)
  values (p_user_id, p_period, greatest(p_images, 0), greatest(p_messages, 0))
  on conflict (user_id, period) do update
    set images_used   = greatest(u.images_used   + p_images,   0),
        messages_used = greatest(u.messages_used + p_messages, 0),
        updated_at    = now()
  returning u.images_used, u.messages_used;
end;
$$;
