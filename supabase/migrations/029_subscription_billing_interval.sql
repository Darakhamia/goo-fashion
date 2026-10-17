-- Migration 029: how often a paid plan is charged.
--
-- Every plan was monthly, so the period was not stored: the renewal cron added
-- a month and charged the plan's price. goo-studio now has a test subscription
-- (Subscriptions → Test subscription): 10 UAH a day on the admin's own card, to
-- watch real charges and renewals without paying a month's price and waiting a
-- month for the next one (BILLING.md, "Test subscription").
--
--   subscriptions.billing_interval
--     '1m' — a real plan, at its price, every month (all existing rows);
--     '1d' — the test: 10 UAH every day. The amount comes from the interval,
--            not from this row, so a daily row can never charge a plan's price.
--
-- Without this file the site works as before; only starting a test
-- subscription answers with an error.
--
-- Changes no existing data: the column is new and existing rows get '1m',
-- which is what they are. Idempotent: safe to re-run.

alter table public.subscriptions
  add column if not exists billing_interval text not null default '1m';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_billing_interval_check'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_billing_interval_check
      check (billing_interval in ('1m', '1d'));
  end if;
end $$;
