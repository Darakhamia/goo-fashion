-- ============================================================================
-- Analytics tables for /admin/analytics dashboard
-- Run this in Supabase SQL editor once.
-- ============================================================================

-- 1. Page view events ────────────────────────────────────────────────────────
create table if not exists public.page_views (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  session_id  text not null,
  user_id     text,                 -- Clerk id when signed in, null for anon
  path        text not null,
  referrer    text,
  utm_source  text,
  utm_medium  text,
  utm_campaign text,
  country     text,                 -- ISO-3166 alpha-2 from edge headers
  device      text,                 -- "mobile" | "tablet" | "desktop"
  browser     text,
  os          text,
  -- Load performance: navigation timing (ms). Nullable — populated when available.
  load_ms     integer,
  ttfb_ms     integer
);

create index if not exists page_views_ts_idx         on public.page_views (ts desc);
create index if not exists page_views_session_idx    on public.page_views (session_id);
create index if not exists page_views_user_idx       on public.page_views (user_id);
create index if not exists page_views_path_idx       on public.page_views (path);
create index if not exists page_views_country_idx    on public.page_views (country);

-- 2. Core Web Vitals samples ─────────────────────────────────────────────────
create table if not exists public.web_vitals (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  session_id  text not null,
  path        text not null,
  metric      text not null,        -- "LCP" | "INP" | "CLS" | "FCP" | "TTFB"
  value       double precision not null,
  rating      text,                 -- "good" | "needs-improvement" | "poor"
  device      text
);

create index if not exists web_vitals_ts_idx     on public.web_vitals (ts desc);
create index if not exists web_vitals_metric_idx on public.web_vitals (metric);
create index if not exists web_vitals_path_idx   on public.web_vitals (path);

-- 3. Domain events for the funnel ────────────────────────────────────────────
-- Tracks product views, outfit views, save clicks, generate calls, etc.
create table if not exists public.analytics_events (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  session_id  text not null,
  user_id     text,
  event       text not null,        -- "product_view" | "outfit_view" | "like" | "save_outfit" | "generate" | "sign_up" | ...
  target_id   text,                 -- product id / outfit id / etc
  props       jsonb                 -- free-form metadata
);

create index if not exists analytics_events_ts_idx     on public.analytics_events (ts desc);
create index if not exists analytics_events_event_idx  on public.analytics_events (event);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);
create index if not exists analytics_events_user_idx   on public.analytics_events (user_id);
create index if not exists analytics_events_target_idx on public.analytics_events (target_id);

-- 4. Enable RLS — API routes use the service role key so they bypass RLS.
-- No policies are added → anon / authenticated keys cannot read or write
-- directly, which is what we want.
alter table public.page_views       enable row level security;
alter table public.web_vitals       enable row level security;
alter table public.analytics_events enable row level security;
