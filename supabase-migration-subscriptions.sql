-- Subscriptions for monobank (Plata by mono) billing.
--
-- One row per user (Clerk user id). The user's *entitlement* still lives in
-- Clerk publicMetadata.plan (read by require-plan.ts); this table is the billing
-- ledger that drives auto-renewal and keeps the saved-card token.
--
-- Run in the Supabase SQL editor.

create table if not exists subscriptions (
  user_id            text primary key,           -- Clerk user id
  plan               text not null,              -- basic | pro | premium
  status             text not null,              -- pending | active | past_due | canceled
  ccy                integer not null default 980,
  amount             integer not null,           -- charged amount, minor units (kopiykas)
  card_token         text,                       -- monobank tokenized card for recurring charges
  masked_pan         text,                       -- masked card number for display, e.g. "424242******4242"
  wallet_id          text,                       -- monobank walletId (we use the Clerk user id)
  last_invoice_id    text,
  current_period_end timestamptz,                -- when the paid month ends / next charge is due
  auto_renew         boolean not null default true,
  failed_charges     integer not null default 0, -- consecutive failed renewals
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Cron renewal scan: "active subscriptions whose period has ended".
create index if not exists subscriptions_renewal_idx
  on subscriptions (current_period_end)
  where status = 'active' and auto_renew = true;

-- Map a monobank invoiceId back to its subscription quickly (webhook lookups).
create index if not exists subscriptions_last_invoice_idx
  on subscriptions (last_invoice_id);
