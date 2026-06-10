-- Billing event log — append-only audit trail of every payment-related action.
--
-- Powers the admin "Subscriptions" page (revenue totals + transaction history)
-- and makes it possible to debug payment problems without digging through app
-- logs. One row per event; never updated.
--
-- Run in the Supabase SQL editor (after subscriptions migration).

create table if not exists billing_events (
  id          bigint generated always as identity primary key,
  user_id     text not null,
  -- checkout_started | payment_success | payment_failed | canceled
  event_type  text not null,
  -- initial | renewal | null (for non-payment events)
  kind        text,
  plan        text,
  invoice_id  text,
  amount      integer,            -- minor units (kopiykas)
  ccy         integer,
  status      text,               -- monobank status, when relevant
  detail      text,               -- error / failure reason / note
  created_at  timestamptz not null default now()
);

create index if not exists billing_events_created_idx on billing_events (created_at desc);
create index if not exists billing_events_user_idx on billing_events (user_id);
create index if not exists billing_events_type_idx on billing_events (event_type);
