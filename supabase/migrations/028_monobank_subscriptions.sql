-- Migration 028: monobank's own subscriptions ("Регулярні платежі").
--
-- Until now a paid plan was a one-off monobank invoice plus our daily cron
-- charging the card the bank saved. The card is saved only if the bank turned
-- tokenization on for the merchant, so in practice a subscription was paid
-- once and never renewed (BILLING.md, "Known gaps"). Now the first choice is a
-- subscription the bank charges by itself every month; the invoice stays as
-- the fallback when the bank refuses one. Without this file checkout keeps
-- using invoices only, as before.
--
--   mono_subscriptions
--     One row per subscription we asked monobank for. monobank's create call
--     has no field for our own id, so each row gets a random secret that goes
--     into the webhook URLs (chargeUrl / statusUrl); only its sha256 is stored
--     here, written before the bank is called. The terms — plan, amount,
--     interval — are frozen at creation: the bank keeps charging what the
--     customer agreed to even if the price changes later.
--
--   mono_subscription_charges
--     One row per charge the bank reports. A charge has no id of its own, only
--     a moment and an amount, so the key is (subscription, moment to the
--     second). A repeated notification is turned away by this key, not by an
--     "is it already there" check.
--
--   subscriptions.mono_subscription_id
--     The bank subscription a paid plan currently runs on. The renewal cron
--     never charges a saved card on such a row: the bank already does.
--
--   goo_record_mono_charge()
--     Records a charge and, for a successful one, extends the paid period —
--     in one transaction, so money is never marked without the period moving
--     or the other way round. Service role only.
--
-- Changes no existing data. Idempotent: safe to re-run.

create table if not exists public.mono_subscriptions (
  id              bigint generated always as identity primary key,
  user_id         text        not null,                 -- Clerk user id
  hook_hash       text        not null unique,          -- sha256(hex) of the secret in our webhook URLs
  subscription_id text        unique,                   -- monobank's id; null until the bank answers
  plan            text        not null,                 -- basic | pro | premium, frozen
  amount          integer     not null,                 -- kopiykas per period, frozen
  ccy             integer     not null default 980,
  "interval"      text        not null default '1m',    -- monobank's "{number}{d|w|m|y}"
  -- creating  — row written, bank not answered yet
  -- created   — payment page issued, not paid yet
  -- active    — at least one charge received
  -- cancelled — stopped by us, the customer or the bank
  -- expired   — never paid; invalidated at the bank
  -- failed    — the bank refused to create it
  status          text        not null default 'creating',
  next_charge_at  timestamptz,
  cancelled_at    timestamptz,
  detail          text,                                 -- refusal or cancellation reason
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists mono_subscriptions_user_idx
  on public.mono_subscriptions (user_id);
create index if not exists mono_subscriptions_live_idx
  on public.mono_subscriptions (status)
  where status in ('created', 'active');

create table if not exists public.mono_subscription_charges (
  subscription_id text        not null,
  charged_at      timestamptz not null,                 -- the bank's moment, cut to the second
  user_id         text        not null,
  plan            text        not null,
  amount          integer     not null,
  ccy             integer     not null,
  status          text        not null,                 -- the bank's status of the charge
  granted         boolean     not null default false,   -- whether it extended the paid period
  created_at      timestamptz not null default now(),
  primary key (subscription_id, charged_at)
);

alter table public.mono_subscriptions        enable row level security;
alter table public.mono_subscription_charges enable row level security;
-- No public policies: billing bookkeeping, reached only through the service
-- role key server-side.

alter table if exists public.subscriptions
  add column if not exists mono_subscription_id text;

-- Returns:
--   'duplicate'         this charge was recorded before; nothing changed
--   'recorded'          recorded, not granted (a failed charge, or the caller
--                       refused it — wrong amount or currency)
--   'after_cancel'      a successful charge dated after we cancelled the
--                       subscription: recorded, period not extended
--   'granted_initial'   the subscription's first paid charge: plan switched on
--   'granted_renewal'   a later one: period extended
--   'granted_late'      a charge made before we cancelled the subscription,
--                       seen only now: period extended, plan left as it is
create or replace function public.goo_record_mono_charge(
  p_subscription_id text,
  p_charged_at      timestamptz,
  p_amount          integer,
  p_ccy             integer,
  p_status          text,
  p_grant           boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.mono_subscriptions%rowtype;
  v_at       timestamptz := date_trunc('second', p_charged_at);
  v_n        integer;
  v_period   interval;
  v_end      timestamptz;
  v_first    boolean;
  v_live     boolean;
  v_inserted integer;
begin
  select * into s from public.mono_subscriptions
   where subscription_id = p_subscription_id
   for update;
  if not found then
    raise exception 'unknown monobank subscription %', p_subscription_id;
  end if;

  -- Cancelled by us before this charge: the money came in after the customer
  -- left. Recorded for a person to look at; the plan is not extended by it.
  if p_grant and p_status = 'success' and s.status = 'cancelled'
     and (s.cancelled_at is null or v_at >= s.cancelled_at) then
    insert into public.mono_subscription_charges
      (subscription_id, charged_at, user_id, plan, amount, ccy, status, granted)
    values (p_subscription_id, v_at, s.user_id, s.plan, p_amount, p_ccy, p_status, false)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;
    return case when v_inserted = 0 then 'duplicate' else 'after_cancel' end;
  end if;

  v_first := not exists (
    select 1 from public.mono_subscription_charges
     where subscription_id = p_subscription_id and granted
  );

  insert into public.mono_subscription_charges
    (subscription_id, charged_at, user_id, plan, amount, ccy, status, granted)
  values (p_subscription_id, v_at, s.user_id, s.plan, p_amount, p_ccy, p_status, p_grant and p_status = 'success')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;
  if not (p_grant and p_status = 'success') then
    return 'recorded';
  end if;

  if s."interval" !~ '^[0-9]+[dwmy]$' then
    raise exception 'unsupported monobank interval % on %', s."interval", p_subscription_id;
  end if;
  v_n := left(s."interval", -1)::integer;
  v_period := case right(s."interval", 1)
    when 'd' then make_interval(days => v_n)
    when 'w' then make_interval(weeks => v_n)
    when 'm' then make_interval(months => v_n)
    else make_interval(years => v_n)
  end;

  -- A subscription we cancelled can still carry a charge made before the
  -- cancellation. It pays for time, but must not take the row back from the
  -- subscription that replaced it.
  v_live := s.status <> 'cancelled';

  select current_period_end into v_end
    from public.subscriptions where user_id = s.user_id
     for update;

  -- Paid time left over is kept: the new period starts at the later of the
  -- charge and the current end.
  insert into public.subscriptions as cur
    (user_id, plan, status, ccy, amount, wallet_id, last_invoice_id,
     current_period_end, auto_renew, failed_charges, mono_subscription_id, updated_at)
  values
    (s.user_id, s.plan, 'active', s.ccy, s.amount, s.user_id, p_subscription_id,
     greatest(coalesce(v_end, v_at), v_at) + v_period, true, 0, p_subscription_id, now())
  on conflict (user_id) do update set
    plan                 = case when v_live then excluded.plan else cur.plan end,
    amount               = case when v_live then excluded.amount else cur.amount end,
    ccy                  = case when v_live then excluded.ccy else cur.ccy end,
    mono_subscription_id = case when v_live then excluded.mono_subscription_id else cur.mono_subscription_id end,
    auto_renew           = case when v_live then true else cur.auto_renew end,
    last_invoice_id      = case when v_live then excluded.last_invoice_id else cur.last_invoice_id end,
    status               = 'active',
    current_period_end   = greatest(coalesce(cur.current_period_end, v_at), v_at) + v_period,
    failed_charges       = 0,
    updated_at           = now();

  if not v_live then
    return 'granted_late';
  end if;

  update public.mono_subscriptions
     set status = 'active', updated_at = now()
   where id = s.id;

  return case when v_first then 'granted_initial' else 'granted_renewal' end;
end;
$$;

-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default. This one moves paid periods, so only the service role keeps it.
revoke all on function public.goo_record_mono_charge(text, timestamptz, integer, integer, text, boolean) from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function public.goo_record_mono_charge(text, timestamptz, integer, integer, text, boolean) from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.goo_record_mono_charge(text, timestamptz, integer, integer, text, boolean) to service_role;
    grant select, insert, update, delete on public.mono_subscriptions to service_role;
    grant select, insert, update, delete on public.mono_subscription_charges to service_role;
  end if;
end $$;

notify pgrst, 'reload schema';
